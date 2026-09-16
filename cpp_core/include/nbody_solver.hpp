#pragma once

#include <cmath>
#include <cstddef>
#include <numeric>
#include <span>
#include <string>
#include <vector>

namespace orbisim {

struct Vec3 {
    double x{0.0};
    double y{0.0};
    double z{0.0};

    constexpr Vec3() noexcept = default;
    constexpr Vec3(double x_, double y_, double z_) noexcept : x(x_), y(y_), z(z_) {}

    constexpr Vec3 operator+(const Vec3& o) const noexcept {
        return {x + o.x, y + o.y, z + o.z};
    }

    constexpr Vec3 operator-(const Vec3& o) const noexcept {
        return {x - o.x, y - o.y, z - o.z};
    }

    constexpr Vec3 operator*(double s) const noexcept {
        return {x * s, y * s, z * s};
    }

    constexpr Vec3 operator/(double s) const noexcept {
        const double inv = 1.0 / s;
        return {x * inv, y * inv, z * inv};
    }

    Vec3& operator+=(const Vec3& o) noexcept {
        x += o.x;
        y += o.y;
        z += o.z;
        return *this;
    }

    Vec3& operator-=(const Vec3& o) noexcept {
        x -= o.x;
        y -= o.y;
        z -= o.z;
        return *this;
    }

    Vec3& operator*=(double s) noexcept {
        x *= s;
        y *= s;
        z *= s;
        return *this;
    }

    [[nodiscard]] constexpr double dot(const Vec3& o) const noexcept {
        return x * o.x + y * o.y + z * o.z;
    }

    [[nodiscard]] constexpr Vec3 cross(const Vec3& o) const noexcept {
        return {
            y * o.z - z * o.y,
            z * o.x - x * o.z,
            x * o.y - y * o.x
        };
    }

    [[nodiscard]] double norm_sq() const noexcept {
        return x * x + y * y + z * z;
    }

    [[nodiscard]] double norm() const noexcept {
        return std::sqrt(norm_sq());
    }
};

inline constexpr Vec3 operator*(double s, const Vec3& v) noexcept {
    return v * s;
}

struct Body {
    std::string name{"body"};
    double mass{1.0};
    Vec3 position;
    Vec3 velocity;

    constexpr Body() noexcept = default;
    Body(std::string name_, double mass_, Vec3 pos, Vec3 vel)
        : name(std::move(name_)), mass(mass_), position(pos), velocity(vel) {}
};

enum class IntegratorType {
    SymplecticVerlet,
    RungeKutta4
};

class NBodySystem {
public:
    explicit NBodySystem(double G = 1.0, double softening = 1e-5);

    void add_body(const Body& body);
    void clear();

    [[nodiscard]] std::size_t size() const noexcept { return bodies_.size(); }
    [[nodiscard]] const std::vector<Body>& bodies() const noexcept { return bodies_; }
    [[nodiscard]] std::vector<Body>& bodies() noexcept { return bodies_; }

    [[nodiscard]] double G() const noexcept { return G_; }
    void set_G(double G) noexcept {
        G_ = G;
        acc_cached_ = false;
    }

    [[nodiscard]] double softening() const noexcept { return softening_; }
    void set_softening(double eps) noexcept {
        softening_ = eps;
        acc_cached_ = false;
    }

    // Physical Invariants & Observables
    [[nodiscard]] Vec3 center_of_mass() const noexcept;
    [[nodiscard]] Vec3 center_of_mass_velocity() const noexcept;
    [[nodiscard]] double total_mass() const noexcept;
    [[nodiscard]] double kinetic_energy() const noexcept;
    [[nodiscard]] double potential_energy() const noexcept;
    [[nodiscard]] double total_energy() const noexcept;
    [[nodiscard]] Vec3 total_angular_momentum() const noexcept;
    [[nodiscard]] Vec3 total_linear_momentum() const noexcept;

    // Acceleration calculation with OpenMP support
    [[nodiscard]] std::vector<Vec3> compute_accelerations() const;
    [[nodiscard]] std::vector<Vec3> compute_accelerations(std::span<const Vec3> positions) const;
    void compute_accelerations_inplace(std::span<const Vec3> positions,
                                       std::span<Vec3> out_acc) const noexcept;

    // Numerical Integrators
    void step_symplectic_verlet(double dt);
    void step_rk4(double dt);
    void step(double dt, IntegratorType type = IntegratorType::SymplecticVerlet);

    // Multi-step trajectory integration
    struct TrajectorySnapshot {
        double time{0.0};
        double total_energy{0.0};
        Vec3 center_of_mass;
        std::vector<Vec3> positions;
        std::vector<Vec3> velocities;
    };

    std::vector<TrajectorySnapshot> simulate(double total_time, double dt,
                                            IntegratorType type = IntegratorType::SymplecticVerlet,
                                            std::size_t snapshot_interval = 1);

private:
    double G_{1.0};
    double softening_{1e-5};
    std::vector<Body> bodies_;

    // Structure of Arrays (SoA) contiguous mass cache for L1 cache locality
    mutable std::vector<double> masses_;
    void sync_masses_cache() const;

    // Performance & HPC cached state for zero-allocation integration
    mutable std::vector<Vec3> cur_acc_;
    mutable std::vector<Vec3> scratch_pos_;
    mutable std::vector<Vec3> scratch_acc_;

    // Zero-allocation persistent buffers for RK4 integration
    mutable std::vector<Vec3> r0_;
    mutable std::vector<Vec3> v0_;
    mutable std::vector<Vec3> r_scratch_;
    mutable std::vector<Vec3> k1_v_;
    mutable std::vector<Vec3> k2_r_;
    mutable std::vector<Vec3> k2_v_;
    mutable std::vector<Vec3> k3_r_;
    mutable std::vector<Vec3> k3_v_;
    mutable std::vector<Vec3> k4_r_;
    mutable std::vector<Vec3> k4_v_;

    mutable bool acc_cached_{false};
};

} // namespace orbisim
