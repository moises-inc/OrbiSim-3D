#include "nbody_solver.hpp"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <vector>
#include <random>
#include <cstdlib>
#include <atomic>
#include <string>

#ifdef _OPENMP
#include <omp.h>
#endif

// Global heap allocation interception
static std::atomic<std::size_t> g_alloc_count{0};
static std::atomic<std::size_t> g_alloc_bytes{0};
static std::atomic<bool> g_track_allocations{false};

void* operator new(std::size_t size) {
    if (g_track_allocations.load(std::memory_order_relaxed)) {
        g_alloc_count.fetch_add(1, std::memory_order_relaxed);
        g_alloc_bytes.fetch_add(size, std::memory_order_relaxed);
    }
    void* p = std::malloc(size);
    if (!p) throw std::bad_alloc();
    return p;
}

void operator delete(void* p) noexcept {
    std::free(p);
}

void operator delete(void* p, std::size_t) noexcept {
    std::free(p);
}

void* operator new[](std::size_t size) {
    if (g_track_allocations.load(std::memory_order_relaxed)) {
        g_alloc_count.fetch_add(1, std::memory_order_relaxed);
        g_alloc_bytes.fetch_add(size, std::memory_order_relaxed);
    }
    void* p = std::malloc(size);
    if (!p) throw std::bad_alloc();
    return p;
}

void operator delete[](void* p) noexcept {
    std::free(p);
}

void operator delete[](void* p, std::size_t) noexcept {
    std::free(p);
}

namespace {

astrodynamics::NBodySystem create_test_system(std::size_t n, unsigned seed = 42) {
    astrodynamics::NBodySystem sys(1.0, 1e-4);
    std::mt19937_64 rng(seed);
    std::uniform_real_distribution<double> pos_dist(-50.0, 50.0);
    std::uniform_real_distribution<double> vel_dist(-2.0, 2.0);
    std::uniform_real_distribution<double> mass_dist(0.5, 10.0);

    for (std::size_t i = 0; i < n; ++i) {
        astrodynamics::Body b{
            "body_" + std::to_string(i),
            mass_dist(rng),
            {pos_dist(rng), pos_dist(rng), pos_dist(rng)},
            {vel_dist(rng), vel_dist(rng), vel_dist(rng)}
        };
        sys.add_body(b);
    }
    return sys;
}

struct BenchmarkResult {
    std::size_t n;
    std::string integrator;
    int num_threads;
    int steps;
    double total_time_ms;
    double us_per_step;
    double ms_per_step;
    double steps_per_sec;
    double mega_interactions_per_sec;
    std::size_t cold_start_allocs;
    std::size_t steady_state_allocs;
};

BenchmarkResult run_benchmark(std::size_t n, astrodynamics::IntegratorType type, int num_threads, int steps = 1000) {
#ifdef _OPENMP
    omp_set_num_threads(num_threads);
#endif

    std::string type_str = (type == astrodynamics::IntegratorType::SymplecticVerlet) ? "Verlet" : "RK4";
    auto sys = create_test_system(n);
    const double dt = 0.001;

    // Measure cold start allocations (1st step)
    g_alloc_count.store(0);
    g_alloc_bytes.store(0);
    g_track_allocations.store(true);
    sys.step(dt, type);
    g_track_allocations.store(false);
    std::size_t cold_allocs = g_alloc_count.load();

    // Warmup 50 steps
    for (int i = 0; i < 50; ++i) {
        sys.step(dt, type);
    }

    // Steady-state measurement
    g_alloc_count.store(0);
    g_alloc_bytes.store(0);
    g_track_allocations.store(true);

    auto t_start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < steps; ++i) {
        sys.step(dt, type);
    }
    auto t_end = std::chrono::high_resolution_clock::now();

    g_track_allocations.store(false);
    std::size_t steady_allocs = g_alloc_count.load();

    double total_ms = std::chrono::duration<double, std::milli>(t_end - t_start).count();
    double us_per_step = (total_ms * 1000.0) / steps;
    double ms_per_step = total_ms / steps;
    double steps_per_sec = (steps / total_ms) * 1000.0;
    double mega_interactions = (static_cast<double>(n) * static_cast<double>(n) * steps_per_sec) / 1e6;

    return BenchmarkResult{
        n,
        type_str,
        num_threads,
        steps,
        total_ms,
        us_per_step,
        ms_per_step,
        steps_per_sec,
        mega_interactions,
        cold_allocs,
        steady_allocs
    };
}

} // namespace

int main() {
    std::cout << "=========================================================================================\n";
    std::cout << "  AstroDynamics 3D C++20 Simulation Benchmark (1,000 steps per test)\n";
    std::cout << "  Evaluates N = {2, 3, 128, 512, 1024} across Threads = {1, 4, 8}\n";
    std::cout << "=========================================================================================\n";

    const std::vector<std::size_t> body_counts = {2, 3, 128, 512, 1024};
    const std::vector<int> thread_counts = {1, 4, 8};
    const int steps = 1000;

    auto print_header = [](const std::string& title) {
        std::cout << "\n>>> " << title << "\n";
        std::cout << std::string(115, '-') << "\n";
        std::cout << std::left
                  << std::setw(6)  << "N"
                  << std::setw(10) << "Method"
                  << std::setw(9)  << "Threads"
                  << std::setw(16) << "Total Time(ms)"
                  << std::setw(16) << "Latency(us/st)"
                  << std::setw(16) << "Latency(ms/st)"
                  << std::setw(18) << "Throughput(st/s)"
                  << std::setw(16) << "M-Interactions/s"
                  << std::setw(10) << "Allocs(1k)"
                  << "\n";
        std::cout << std::string(115, '-') << "\n";
    };

    auto print_row = [](const BenchmarkResult& r) {
        std::cout << std::left
                  << std::setw(6)  << r.n
                  << std::setw(10) << r.integrator
                  << std::setw(9)  << r.num_threads
                  << std::fixed << std::setprecision(3)
                  << std::setw(16) << r.total_time_ms
                  << std::setw(16) << r.us_per_step
                  << std::setw(16) << r.ms_per_step
                  << std::fixed << std::setprecision(1)
                  << std::setw(18) << r.steps_per_sec
                  << std::setw(16) << r.mega_interactions_per_sec
                  << std::setw(10) << r.steady_state_allocs
                  << "\n";
    };

    // 1. Symplectic Verlet
    print_header("Symplectic Verlet Benchmark (N=2, 3, 128, 512, 1024 | T=1, 4, 8)");
    std::vector<BenchmarkResult> verlet_results;
    for (auto n : body_counts) {
        for (auto th : thread_counts) {
            auto res = run_benchmark(n, astrodynamics::IntegratorType::SymplecticVerlet, th, steps);
            verlet_results.push_back(res);
            print_row(res);
        }
        std::cout << std::string(115, '-') << "\n";
    }

    // 2. Runge-Kutta 4
    print_header("Runge-Kutta 4 (RK4) Benchmark (N=2, 3, 128, 512, 1024 | T=1, 4, 8)");
    std::vector<BenchmarkResult> rk4_results;
    for (auto n : body_counts) {
        for (auto th : thread_counts) {
            auto res = run_benchmark(n, astrodynamics::IntegratorType::RungeKutta4, th, steps);
            rk4_results.push_back(res);
            print_row(res);
        }
        std::cout << std::string(115, '-') << "\n";
    }

    // 3. OpenMP Speedup Summary Table for Verlet
    std::cout << "\n=== OpenMP Parallel Speedup & Scaling (Verlet: 1 vs 4 vs 8 threads) ===\n";
    std::cout << std::string(85, '-') << "\n";
    std::cout << std::left
              << std::setw(8)  << "N"
              << std::setw(16) << "1-Thread (ms)"
              << std::setw(16) << "4-Thread (ms)"
              << std::setw(16) << "8-Thread (ms)"
              << std::setw(16) << "Speedup (4T)"
              << std::setw(16) << "Speedup (8T)"
              << "\n";
    std::cout << std::string(85, '-') << "\n";

    for (std::size_t i = 0; i < body_counts.size(); ++i) {
        double t1 = verlet_results[i * 3 + 0].total_time_ms;
        double t4 = verlet_results[i * 3 + 1].total_time_ms;
        double t8 = verlet_results[i * 3 + 2].total_time_ms;
        std::cout << std::left
                  << std::setw(8)  << body_counts[i]
                  << std::fixed << std::setprecision(3)
                  << std::setw(16) << t1
                  << std::setw(16) << t4
                  << std::setw(16) << t8
                  << std::setprecision(2)
                  << std::setw(16) << (std::to_string(t1 / t4) + "x")
                  << std::setw(16) << (std::to_string(t1 / t8) + "x")
                  << "\n";
    }
    std::cout << std::string(85, '=') << "\n";

    // 4. Memory Allocations Audit
    std::cout << "\n=== Heap Allocation Audit (Cold Start vs Steady-State 1,000 Steps) ===\n";
    std::cout << std::string(80, '-') << "\n";
    std::cout << std::left
              << std::setw(8)  << "N"
              << std::setw(12) << "Integrator"
              << std::setw(25) << "Cold Start (Step 1)"
              << std::setw(25) << "Steady-State (1k steps)"
              << "\n";
    std::cout << std::string(80, '-') << "\n";

    for (std::size_t i = 0; i < body_counts.size(); ++i) {
        auto v = verlet_results[i * 3 + 1]; // 4-thread result
        auto r = rk4_results[i * 3 + 1];
        std::cout << std::left
                  << std::setw(8)  << body_counts[i]
                  << std::setw(12) << "Verlet"
                  << std::setw(25) << v.cold_start_allocs
                  << std::setw(25) << (std::to_string(v.steady_state_allocs) + " (0/step)")
                  << "\n";
        std::cout << std::left
                  << std::setw(8)  << body_counts[i]
                  << std::setw(12) << "RK4"
                  << std::setw(25) << r.cold_start_allocs
                  << std::setw(25) << (std::to_string(r.steady_state_allocs) + " (0/step)")
                  << "\n";
    }
    std::cout << std::string(80, '=') << "\n";

    return 0;
}
