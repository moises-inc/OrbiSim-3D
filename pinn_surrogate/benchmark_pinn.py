import time
import tracemalloc
import gc
import torch
from model import HamiltonianNN, symplectic_euler_step, rollout_surrogate

def benchmark_hnn():
    print("=" * 80)
    print("  OrbiSim-3D — PyTorch HNN Surrogate Performance & Memory Benchmark")
    print("=" * 80)
    print(f"PyTorch Version: {torch.__version__}")
    print(f"Device: CPU (Threads: {torch.get_num_threads()})")
    print("=" * 80)

    torch.manual_seed(42)

    configs = [
        {"name": "Separable (dim=2, hidden=64, 2 layers)", "dim": 2, "hidden": 64, "layers": 2, "sep": True},
        {"name": "Separable (dim=3, hidden=128, 3 layers)", "dim": 3, "hidden": 128, "layers": 3, "sep": True},
        {"name": "Joint H(q,p) (dim=2, hidden=64, 2 layers)", "dim": 2, "hidden": 64, "layers": 2, "sep": False},
        {"name": "Joint H(q,p) (dim=3, hidden=128, 3 layers)", "dim": 3, "hidden": 128, "layers": 3, "sep": False},
    ]

    for cfg in configs:
        print(f"\nEvaluating: {cfg['name']}")
        model = HamiltonianNN(
            dim=cfg["dim"],
            hidden_dim=cfg["hidden"],
            num_layers=cfg["layers"],
            separable=cfg["sep"],
        )
        model.eval()

        dim = cfg["dim"]
        q0 = torch.randn(dim)
        p0 = torch.randn(dim)

        # 1. Forward pass latency
        num_warmup = 100
        num_iters = 1000

        for _ in range(num_warmup):
            _ = model(q0.unsqueeze(0), p0.unsqueeze(0))

        t0 = time.perf_counter()
        for _ in range(num_iters):
            _ = model(q0.unsqueeze(0), p0.unsqueeze(0))
        t1 = time.perf_counter()
        fwd_us = ((t1 - t0) / num_iters) * 1e6
        fwd_throughput = num_iters / (t1 - t0)

        # 2. Autodiff time_derivatives latency (create_graph=False)
        q_var = q0.clone().detach().requires_grad_(True)
        p_var = p0.clone().detach().requires_grad_(True)
        for _ in range(num_warmup):
            _ = model.time_derivatives(q_var, p_var, create_graph=False)

        t0 = time.perf_counter()
        for _ in range(num_iters):
            _ = model.time_derivatives(q_var, p_var, create_graph=False)
        t1 = time.perf_counter()
        grad_us = ((t1 - t0) / num_iters) * 1e6
        grad_throughput = num_iters / (t1 - t0)

        # 3. Autodiff time_derivatives latency (create_graph=True, for training)
        t0 = time.perf_counter()
        for _ in range(200):
            _ = model.time_derivatives(q_var, p_var, create_graph=True)
        t1 = time.perf_counter()
        train_grad_us = ((t1 - t0) / 200) * 1e6

        # 4. Symplectic Euler step latency (2 autodiff passes per step)
        curr_q = q0.clone()
        curr_p = p0.clone()
        for _ in range(50):
            curr_q, curr_p = symplectic_euler_step(model, curr_q, curr_p, 0.01)

        t0 = time.perf_counter()
        for _ in range(num_iters):
            curr_q, curr_p = symplectic_euler_step(model, curr_q, curr_p, 0.01)
        t1 = time.perf_counter()
        step_ms = ((t1 - t0) / num_iters) * 1000.0
        step_us = step_ms * 1000.0
        step_throughput = num_iters / (t1 - t0)

        print(f"  - Forward Pass:          {fwd_us:7.2f} us/call | {fwd_throughput:10.1f} calls/s")
        print(f"  - Autodiff (Inference):  {grad_us:7.2f} us/call | {grad_throughput:10.1f} calls/s")
        print(f"  - Autodiff (Training):   {train_grad_us:7.2f} us/call")
        print(f"  - Symplectic Euler Step: {step_ms:7.3f} ms/step ({step_us:.1f} us) | {step_throughput:8.1f} steps/s")

    # 5. Multi-step Rollout & Memory Allocation Profiling
    print("\n" + "=" * 80)
    print("  Rollout Memory Allocation & Scaling (Separable dim=2, hidden=64)")
    print("=" * 80)

    model = HamiltonianNN(dim=2, hidden_dim=64, num_layers=2, separable=True)
    model.eval()
    q0 = torch.tensor([1.0, 0.0])
    p0 = torch.tensor([0.0, 1.0])

    step_counts = [100, 500, 1000, 2000]

    print(f"{'Steps':<8} {'Total Time (ms)':<18} {'ms/step':<12} {'Steps/sec':<14} {'Peak Mem (KB)':<16} {'Bytes/step':<12}")
    print("-" * 80)

    for n_steps in step_counts:
        gc.collect()
        tracemalloc.start()
        snap_before = tracemalloc.take_snapshot()

        t0 = time.perf_counter()
        q_tr, p_tr, h_tr = rollout_surrogate(model, q0, p0, num_steps=n_steps, dt=0.01)
        t1 = time.perf_counter()

        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        total_ms = (t1 - t0) * 1000.0
        ms_per_step = total_ms / n_steps
        steps_sec = n_steps / (t1 - t0)
        peak_kb = peak_mem / 1024.0
        bytes_per_step = peak_mem / n_steps

        print(f"{n_steps:<8} {total_ms:<18.2f} {ms_per_step:<12.3f} {steps_sec:<14.1f} {peak_kb:<16.2f} {bytes_per_step:<12.1f}")

    print("=" * 80)

if __name__ == "__main__":
    benchmark_hnn()
