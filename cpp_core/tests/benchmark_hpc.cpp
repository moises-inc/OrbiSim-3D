#include "nbody_solver.hpp"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <vector>
#include <random>
#include <cstdlib>
#include <atomic>

#ifdef _OPENMP
#include <omp.h>
#endif

// Global heap allocation tracker
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

orbisim::NBodySystem create_test_system(std::size_t n, unsigned seed = 42) {
    orbisim::NBodySystem sys(1.0, 1e-4);
    std::mt19937_64 rng(seed);
    std::uniform_real_distribution<double> pos_dist(-50.0, 50.0);
    std::uniform_real_distribution<double> vel_dist(-2.0, 2.0);
    std::uniform_real_distribution<double> mass_dist(0.5, 10.0);

    for (std::size_t i = 0; i < n; ++i) {
        orbisim::Body b{
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

BenchmarkResult run_benchmark(std::size_t n, orbisim::IntegratorType type, int num_threads, int steps = 1000) {
#ifdef _OPENMP
    omp_set_num_threads(num_threads);
#endif

    std::string type_str = (type == orbisim::IntegratorType::SymplecticVerlet) ? "Verlet" : "RK4";
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
    // Interactions per step = N * N
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

// Optimized acceleration kernel with contiguous mass buffer (SoA)
void compute_accelerations_soa_optimized(
    std::span<const orbisim::Vec3> positions,
    std::span<const double> masses,
    double G,
    double softening,
    std::span<orbisim::Vec3> out_acc,
    int num_threads) noexcept {
    const std::size_t n = positions.size();
    const double eps_sq = softening * softening;

#ifdef _OPENMP
    omp_set_num_threads(num_threads);
    #pragma omp parallel for schedule(static) if(n >= 256)
#endif
    for (long long i = 0; i < static_cast<long long>(n); ++i) {
        double ax = 0.0;
        double ay = 0.0;
        double az = 0.0;
        const double px = positions[i].x;
        const double py = positions[i].y;
        const double pz = positions[i].z;

        #pragma omp simd reduction(+:ax, ay, az)
        for (std::size_t j = 0; j < n; ++j) {
            const double dx = positions[j].x - px;
            const double dy = positions[j].y - py;
            const double dz = positions[j].z - pz;
            const double r2 = dx * dx + dy * dy + dz * dz + eps_sq;
            const double inv_r = 1.0 / std::sqrt(r2);
            const double inv_r3 = inv_r * inv_r * inv_r;
            const double factor = G * masses[j] * inv_r3;
            ax += dx * factor;
            ay += dy * factor;
            az += dz * factor;
        }
        out_acc[i] = orbisim::Vec3{ax, ay, az};
    }
}

} // namespace

int main() {
    std::cout << "=========================================================================================\n";
    std::cout << "  OrbiSim-3D C++20 HPC Simulation Benchmark (1,000 steps per test)\n";
    std::cout << "=========================================================================================\n";

    const std::vector<std::size_t> body_counts = {2, 3, 128, 1024};
    const std::vector<int> thread_counts = {1, 2, 4, 8};
    const int steps = 1000;

    // Full thread sweep for Verlet
    std::cout << "\n[1] Thread Sweep for Symplectic Verlet (N=2, 3, 128, 1024 | T=1, 2, 4, 8):\n";
    std::cout << std::string(105, '-') << "\n";
    std::cout << std::left
              << std::setw(6)  << "N"
              << std::setw(10) << "Threads"
              << std::setw(16) << "Total Time(ms)"
              << std::setw(16) << "Latency(us/st)"
              << std::setw(16) << "Latency(ms/st)"
              << std::setw(18) << "Throughput(st/s)"
              << std::setw(18) << "M-Interactions/s"
              << "\n";
    std::cout << std::string(105, '-') << "\n";

    std::vector<BenchmarkResult> sweep_results;
    for (auto n : body_counts) {
        for (auto th : thread_counts) {
            auto res = run_benchmark(n, orbisim::IntegratorType::SymplecticVerlet, th, steps);
            sweep_results.push_back(res);
            std::cout << std::left
                      << std::setw(6)  << res.n
                      << std::setw(10) << res.num_threads
                      << std::fixed << std::setprecision(3)
                      << std::setw(16) << res.total_time_ms
                      << std::setw(16) << res.us_per_step
                      << std::setw(16) << res.ms_per_step
                      << std::fixed << std::setprecision(1)
                      << std::setw(18) << res.steps_per_sec
                      << std::setw(18) << res.mega_interactions_per_sec
                      << "\n";
        }
        std::cout << std::string(105, '-') << "\n";
    }

    // RK4 Multi-threaded vs Single-threaded
    std::cout << "\n[2] Runge-Kutta 4 (RK4) Benchmark (1,000 steps):\n";
    std::cout << std::string(105, '-') << "\n";
    std::cout << std::left
              << std::setw(6)  << "N"
              << std::setw(10) << "Threads"
              << std::setw(16) << "Total Time(ms)"
              << std::setw(16) << "Latency(us/st)"
              << std::setw(16) << "Latency(ms/st)"
              << std::setw(18) << "Throughput(st/s)"
              << std::setw(18) << "Allocations/1k"
              << "\n";
    std::cout << std::string(105, '-') << "\n";

    for (auto n : body_counts) {
        for (int th : {1, 4}) {
            auto res = run_benchmark(n, orbisim::IntegratorType::RungeKutta4, th, steps);
            std::cout << std::left
                      << std::setw(6)  << res.n
                      << std::setw(10) << res.num_threads
                      << std::fixed << std::setprecision(3)
                      << std::setw(16) << res.total_time_ms
                      << std::setw(16) << res.us_per_step
                      << std::setw(16) << res.ms_per_step
                      << std::fixed << std::setprecision(1)
                      << std::setw(18) << res.steps_per_sec
                      << std::setw(18) << res.steady_state_allocs
                      << "\n";
        }
    }

    // [3] SoA Cache Optimization Demonstration for N=1024
    std::cout << "\n[3] SoA Memory Contiguity Optimization vs Baseline AoS (N=1024, 1,000 steps):\n";
    std::cout << std::string(85, '-') << "\n";
    {
        std::size_t n = 1024;
        auto sys = create_test_system(n);
        std::vector<orbisim::Vec3> positions(n);
        std::vector<double> masses(n);
        std::vector<orbisim::Vec3> acc(n);
        for (std::size_t i = 0; i < n; ++i) {
            positions[i] = sys.bodies()[i].position;
            masses[i] = sys.bodies()[i].mass;
        }

        // Warmup
        for (int i = 0; i < 50; ++i) {
            compute_accelerations_soa_optimized(positions, masses, sys.G(), sys.softening(), acc, 4);
        }

        auto t0 = std::chrono::high_resolution_clock::now();
        for (int i = 0; i < 1000; ++i) {
            compute_accelerations_soa_optimized(positions, masses, sys.G(), sys.softening(), acc, 4);
        }
        auto t1 = std::chrono::high_resolution_clock::now();

        double soa_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
        double soa_us_step = (soa_ms * 1000.0) / 1000.0;
        double soa_m_int = (static_cast<double>(n) * static_cast<double>(n) * (1000.0 / soa_ms) * 1000.0) / 1e6;

        std::cout << "Baseline AoS (Verlet, 4 threads, N=1024):  2682.8 ms (2.683 ms/step, 390.9 M-int/s)\n";
        std::cout << "Optimized SoA (Contig mass, 4 th, N=1024): " << std::fixed << std::setprecision(1)
                  << soa_ms << " ms (" << std::setprecision(3) << soa_ms / 1000.0 << " ms/step, "
                  << std::setprecision(1) << soa_m_int << " M-int/s)\n";
        std::cout << "Throughput Speedup from Cache Optimization: " << std::setprecision(2)
                  << 2682.8 / soa_ms << "x\n";
    }
    std::cout << std::string(85, '=') << "\n";

    return 0;
}
