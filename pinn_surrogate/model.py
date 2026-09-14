r"""
Hamiltonian Neural Network (HNN) & Symplectic PINN Surrogate for OrbiSim-3D.

Enforces canonical Hamiltonian equations via autodifferentiation:
    \dot{q} = \partial H / \partial p
    \dot{p} = -\partial H / \partial q

Loss function:
    L = || \nabla_p H - \dot{q} ||^2 + || \nabla_q H + \dot{p} ||^2 + \lambda_E * || H(q_t, p_t) - H_0 ||^2
"""

from typing import Tuple, Optional, Union
import torch
import torch.nn as nn


class HamiltonianNN(nn.Module):
    """
    Parametrizes the scalar Hamiltonian energy function H_theta(q, p).
    Uses smooth C^2 activation functions (Tanh / SiLU) to ensure well-defined gradients.
    """

    def __init__(
        self,
        dim: int = 3,
        hidden_dim: int = 128,
        num_layers: int = 3,
        activation: str = "tanh",
        separable: bool = False,
    ):
        """
        Args:
            dim: Coordinate dimensionality (e.g., 3 for 3D coordinates per body).
            hidden_dim: Number of neurons per hidden layer.
            num_layers: Number of hidden layers.
            activation: Activation function ('tanh' or 'silu').
            separable: If True, models H(q, p) = T(p) + V(q) separately.
        """
        super().__init__()
        self.dim = dim
        self.separable = separable

        act_cls = nn.Tanh if activation.lower() == "tanh" else nn.SiLU

        if separable:
            # Kinetic branch T(p)
            t_layers = [nn.Linear(dim, hidden_dim), act_cls()]
            for _ in range(num_layers - 1):
                t_layers.extend([nn.Linear(hidden_dim, hidden_dim), act_cls()])
            t_layers.append(nn.Linear(hidden_dim, 1, bias=False))
            self.net_T = nn.Sequential(*t_layers)

            # Potential branch V(q)
            v_layers = [nn.Linear(dim, hidden_dim), act_cls()]
            for _ in range(num_layers - 1):
                v_layers.extend([nn.Linear(hidden_dim, hidden_dim), act_cls()])
            v_layers.append(nn.Linear(hidden_dim, 1, bias=False))
            self.net_V = nn.Sequential(*v_layers)
        else:
            # Joint H(q, p)
            layers = [nn.Linear(2 * dim, hidden_dim), act_cls()]
            for _ in range(num_layers - 1):
                layers.extend([nn.Linear(hidden_dim, hidden_dim), act_cls()])
            layers.append(nn.Linear(hidden_dim, 1, bias=False))
            self.net = nn.Sequential(*layers)

    def forward(self, q: torch.Tensor, p: torch.Tensor) -> torch.Tensor:
        """
        Computes scalar Hamiltonian energy H(q, p).

        Args:
            q: Generalized coordinates [..., dim].
            p: Generalized momenta [..., dim].

        Returns:
            Scalar Hamiltonian energy [..., 1].
        """
        if self.separable:
            return self.net_T(p) + self.net_V(q)
        else:
            qp = torch.cat([q, p], dim=-1)
            return self.net(qp)

    def time_derivatives(
        self, q: torch.Tensor, p: torch.Tensor, create_graph: bool = True
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        r"""
        Computes canonical phase space vector field (\dot{q}, \dot{p}) via autodiff:
            \dot{q} = \partial H / \partial p
            \dot{p} = -\partial H / \partial q

        Args:
            q: Generalized coordinates tensor (must track gradients).
            p: Generalized momenta tensor (must track gradients).
            create_graph: Set to True for higher-order derivatives during training.

        Returns:
            Tuple of (\dot{q}_pred, \dot{p}_pred).
        """
        if not q.requires_grad:
            q = q.clone().detach().requires_grad_(True)
        if not p.requires_grad:
            p = p.clone().detach().requires_grad_(True)

        H = self.forward(q, p)
        H_sum = H.sum()

        grads = torch.autograd.grad(
            outputs=H_sum,
            inputs=[q, p],
            create_graph=create_graph,
            retain_graph=True,
            only_inputs=True,
        )
        dH_dq, dH_dp = grads[0], grads[1]

        q_dot = dH_dp
        p_dot = -dH_dq

        return q_dot, p_dot


class SymplecticPINNLoss(nn.Module):
    r"""
    Symplectic loss enforcing canonical Hamiltonian physics and optional energy invariance:
        L = || \nabla_p H - \dot{q} ||^2 + || \nabla_q H + \dot{p} ||^2 + \lambda_E * || H(t) - H(0) ||^2
    """

    def __init__(self, energy_weight: float = 0.01):
        super().__init__()
        self.energy_weight = energy_weight
        self.mse = nn.MSELoss()

    def forward(
        self,
        model: HamiltonianNN,
        q: torch.Tensor,
        p: torch.Tensor,
        q_dot_true: torch.Tensor,
        p_dot_true: torch.Tensor,
        h0_true: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, dict]:
        """
        Calculates the symplectic loss.

        Returns:
            total_loss: Scalar loss tensor.
            metrics: Dictionary of individual loss components.
        """
        q_dot_pred, p_dot_pred = model.time_derivatives(q, p, create_graph=True)

        loss_q_dot = self.mse(q_dot_pred, q_dot_true)
        loss_p_dot = self.mse(p_dot_pred, p_dot_true)
        loss_symplectic = loss_q_dot + loss_p_dot

        loss_energy = torch.tensor(0.0, device=q.device)
        if h0_true is not None and self.energy_weight > 0.0:
            h_pred = model(q, p)
            loss_energy = self.mse(h_pred, h0_true)

        total_loss = loss_symplectic + self.energy_weight * loss_energy

        metrics = {
            "loss_total": total_loss.item(),
            "loss_symplectic": loss_symplectic.item(),
            "loss_q_dot": loss_q_dot.item(),
            "loss_p_dot": loss_p_dot.item(),
            "loss_energy": loss_energy.item() if isinstance(loss_energy, torch.Tensor) else 0.0,
        }

        return total_loss, metrics


def symplectic_euler_step(
    model: HamiltonianNN, q: torch.Tensor, p: torch.Tensor, dt: float
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Performs one step of Symplectic Euler integration using the learned Hamiltonian:
        p_{n+1} = p_n - dt * \nabla_q H(q_n, p_n)
        q_{n+1} = q_n + dt * \nabla_p H(q_n, p_{n+1})
    """
    with torch.no_grad():
        q_var = q.clone().detach().requires_grad_(True)
        p_var = p.clone().detach().requires_grad_(True)

    # Gradient at (q_n, p_n)
    q_dot_0, p_dot_0 = model.time_derivatives(q_var, p_var, create_graph=False)
    p_next = (p + dt * p_dot_0).detach()

    # Gradient with updated momentum p_{n+1}
    p_next_var = p_next.clone().detach().requires_grad_(True)
    q_dot_1, _ = model.time_derivatives(q_var, p_next_var, create_graph=False)
    q_next = (q + dt * q_dot_1).detach()

    return q_next, p_next


def rollout_surrogate(
    model: HamiltonianNN,
    q0: torch.Tensor,
    p0: torch.Tensor,
    num_steps: int,
    dt: float,
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Rolls out trajectory over multiple steps using learned Hamiltonian vector field.

    Returns:
        q_trajectory: [num_steps + 1, dim]
        p_trajectory: [num_steps + 1, dim]
        h_trajectory: [num_steps + 1, 1]
    """
    model.eval()
    q_list = [q0]
    p_list = [p0]
    h_list = [model(q0.unsqueeze(0), p0.unsqueeze(0)).squeeze(0)]

    curr_q = q0
    curr_p = p0

    for _ in range(num_steps):
        curr_q, curr_p = symplectic_euler_step(model, curr_q, curr_p, dt)
        curr_h = model(curr_q.unsqueeze(0), curr_p.unsqueeze(0)).squeeze(0)

        q_list.append(curr_q)
        p_list.append(curr_p)
        h_list.append(curr_h)

    return (
        torch.stack(q_list, dim=0),
        torch.stack(p_list, dim=0),
        torch.stack(h_list, dim=0),
    )
