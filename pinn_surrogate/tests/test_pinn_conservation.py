"""
pytest suite certifying Hamiltonian conservation, symplectic loss autodiff,
and 1,000+ step energy stability for OrbiSim-3D Symplectic PINN.
"""

import sys
import os
import pytest
import torch
import torch.nn as nn
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from model import (
    HamiltonianNN,
    SymplecticPINNLoss,
    symplectic_euler_step,
    rollout_surrogate,
)


@pytest.fixture
def hnn_model():
    torch.manual_seed(42)
    return HamiltonianNN(dim=2, hidden_dim=64, num_layers=2, activation="tanh")


def test_hamiltonian_autodiff_gradients(hnn_model):
    r"""
    Verifies that time_derivatives properly calculates \dot{q} = \partial H / \partial p
    and \dot{p} = -\partial H / \partial q via PyTorch autograd.
    """
    q = torch.tensor([[1.0, -0.5]], requires_grad=True)
    p = torch.tensor([[0.2, 0.8]], requires_grad=True)

    q_dot, p_dot = hnn_model.time_derivatives(q, p)

    assert q_dot.shape == (1, 2)
    assert p_dot.shape == (1, 2)
    assert not torch.isnan(q_dot).any()
    assert not torch.isnan(p_dot).any()

    # Numerical verification via finite differences on scalar H
    eps = 1e-5
    # Check dH/dp_0
    p_plus = p.clone().detach()
    p_plus[0, 0] += eps
    p_minus = p.clone().detach()
    p_minus[0, 0] -= eps

    h_plus = hnn_model(q, p_plus)
    h_minus = hnn_model(q, p_minus)
    fd_dH_dp0 = (h_plus - h_minus) / (2.0 * eps)

    assert torch.allclose(q_dot[0, 0], fd_dH_dp0[0, 0], atol=1e-3)


def test_symplectic_loss_backpropagation(hnn_model):
    """
    Verifies that SymplecticPINNLoss computes loss and allows backpropagation to parameters.
    """
    loss_fn = SymplecticPINNLoss(energy_weight=0.1)
    optimizer = torch.optim.Adam(hnn_model.parameters(), lr=1e-3)

    q = torch.randn(16, 2, requires_grad=True)
    p = torch.randn(16, 2, requires_grad=True)

    # Synthetic targets (Harmonic oscillator: \dot{q} = p, \dot{p} = -q)
    q_dot_true = p.detach()
    p_dot_true = -q.detach()
    h0_true = 0.5 * (p**2 + q**2).sum(dim=-1, keepdim=True).detach()

    optimizer.zero_grad()
    loss, metrics = loss_fn(hnn_model, q, p, q_dot_true, p_dot_true, h0_true)

    assert loss.item() > 0.0
    assert "loss_symplectic" in metrics
    assert "loss_energy" in metrics

    loss.backward()

    # Check that model weights received valid gradients
    has_grad = False
    for param in hnn_model.parameters():
        if param.grad is not None:
            has_grad = True
            assert not torch.isnan(param.grad).any()
    assert has_grad


def test_energy_conservation_1000_steps():
    """
    Certifies energy conservation and absence of secular energy drift
    over 1,000+ simulation steps using learned / exact Hamiltonian surrogate.
    """
    torch.manual_seed(42)
    # Quadratic harmonic model H(q, p) = 0.5 * (p^2 + q^2)
    # Train separable Hamiltonian NN quickly to fit H(q, p)
    model = HamiltonianNN(dim=2, hidden_dim=32, num_layers=2, separable=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = SymplecticPINNLoss(energy_weight=0.05)

    # 100 fast training iterations on canonical harmonic oscillator phase space
    for _ in range(120):
        q_sample = torch.randn(64, 2)
        p_sample = torch.randn(64, 2)
        q_dot_target = p_sample.clone()
        p_dot_target = -q_sample.clone()
        h_target = 0.5 * (q_sample**2 + p_sample**2).sum(dim=-1, keepdim=True)

        optimizer.zero_grad()
        loss, _ = loss_fn(model, q_sample, p_sample, q_dot_target, p_dot_target, h_target)
        loss.backward()
        optimizer.step()

    # Initial condition: circular orbit in phase space (q0 = [1.0, 0.0], p0 = [0.0, 1.0])
    q0 = torch.tensor([1.0, 0.0])
    p0 = torch.tensor([0.0, 1.0])
    num_steps = 1000
    dt = 0.005

    q_traj, p_traj, h_traj = rollout_surrogate(model, q0, p0, num_steps=num_steps, dt=dt)

    assert q_traj.shape == (num_steps + 1, 2)
    assert p_traj.shape == (num_steps + 1, 2)
    assert h_traj.shape == (num_steps + 1, 1)

    h_initial = h_traj[0].item()
    h_max = torch.max(h_traj).item()
    h_min = torch.min(h_traj).item()

    # Relative energy oscillation along 1,000 steps
    rel_variation = abs(h_max - h_min) / abs(h_initial)

    # In symplectic integrators, energy error is strictly bounded without secular divergence
    assert rel_variation < 0.05, f"Energy variation {rel_variation} exceeded threshold 0.05"
    assert not torch.isnan(q_traj).any()
    assert not torch.isinf(q_traj).any()
