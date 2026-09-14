#include "nbody_solver.hpp"

#include <cmath>
#include <stdexcept>
#include <utility>

#ifdef _OPENMP
#include <omp.h>
#endif

namespace orbisim {

NBodySystem::NBodySystem(double G, double softening)
    : G_(G), softening_(softening) {}

void NBodySystem::add_body(const Body& body) {
    bodies_.push_back(body);
    acc_cached_ = false;
}

void NBodySystem::clear() {
    bodies_.clear();
    acc_cached_ = false;
}

double NBodySystem::total_mass() const noexcept {
    double m_tot = 0.0;
    for (const auto& b : bodies_) {
        m_tot += b.mass;
    }
    return m_tot;
}

Vec3 NBodySystem::center_of_mass() const noexcept {
    const double m_tot = total_mass();
    if (m_tot <= 0.0) {
        return {0.0, 0.0, 0.0};
    }
    Vec3 r_cm{0.0, 0.0, 0.0};
    for (const auto& b : bodies_) {
        r_cm += b.position * b.mass;
    }
    return r_cm / m_tot;
}

Vec3 NBodySystem::center_of_mass_velocity() const noexcept {
    const double m_tot = total_mass();
    if (m_tot <= 0.0) {
        return {0.0, 0.0, 0.0};
    }
    Vec3 v_cm{0.0, 0.0, 0.0};
    for (const auto& b : bodies_) {
        v_cm += b.velocity * b.mass;
    }
    return v_cm / m_tot;
}

double NBodySystem::kinetic_energy() const noexcept {
    double t = 0.0;
    for (const auto& b : bodies_) {
        t += 0.5 * b.mass * b.velocity.norm_sq();
    }
    return t;
}

double NBodySystem::potential_energy() const noexcept {
    double u = 0.0;
    const std::size_t n = bodies_.size();
    const double eps_sq = softening_ * softening_;

    for (std::size_t i = 0; i < n; ++i) {
        for (std::size_t j = i + 1; j < n; ++j) {
            const Vec3 dr = bodies_[j].position - bodies_[i].position;
            const double dist = std::sqrt(dr.norm_sq() + eps_sq);
            u -= (G_ * bodies_[i].mass * bodies_[j].mass) / dist;
        }
    }
    return u;
}

double NBodySystem::total_energy() const noexcept {
    return kinetic_energy() + potential_energy();
}

Vec3 NBodySystem::total_angular_momentum() const noexcept {
    Vec3 L{0.0, 0.0, 0.0};
    for (const auto& b : bodies_) {
        L += b.position.cross(b.velocity) * b.mass;
    }
    return L;
}

Vec3 NBodySystem::total_linear_momentum() const noexcept {
    Vec3 P{0.0, 0.0, 0.0};
    for (const auto& b : bodies_) {
        P += b.velocity * b.mass;
    }
    return P;
}

void NBodySystem::compute_accelerations_inplace(
    std::span<const Vec3> positions, std::span<Vec3> out_acc) const noexcept {
    const std::size_t n = positions.size();
    const double eps_sq = softening_ * softening_;
    const double G = G_;

    #pragma omp parallel for schedule(static) if(n >= 128)
    for (long long i = 0; i < static_cast<long long>(n); ++i) {
        double ax = 0.0;
        double ay = 0.0;
        double az = 0.0;
        const double px = positions[i].x;
        const double py = positions[i].y;
        const double pz = positions[i].z;

        // Branchless SIMD inner loop: self-interaction gives dx=dy=dz=0, producing exactly 0 force
        #pragma omp simd reduction(+:ax, ay, az)
        for (std::size_t j = 0; j < n; ++j) {
            const double dx = positions[j].x - px;
            const double dy = positions[j].y - py;
            const double dz = positions[j].z - pz;
            const double r2 = dx * dx + dy * dy + dz * dz + eps_sq;
            const double inv_r = 1.0 / std::sqrt(r2);
            const double inv_r3 = inv_r * inv_r * inv_r;
            const double factor = G * bodies_[j].mass * inv_r3;
            ax += dx * factor;
            ay += dy * factor;
            az += dz * factor;
        }

        out_acc[i] = Vec3{ax, ay, az};
    }
}

std::vector<Vec3> NBodySystem::compute_accelerations() const {
    const std::size_t n = bodies_.size();
    std::vector<Vec3> positions(n);
    for (std::size_t i = 0; i < n; ++i) {
        positions[i] = bodies_[i].position;
    }
    std::vector<Vec3> accelerations(n);
    compute_accelerations_inplace(positions, accelerations);
    return accelerations;
}

std::vector<Vec3> NBodySystem::compute_accelerations(std::span<const Vec3> positions) const {
    const std::size_t n = positions.size();
    std::vector<Vec3> accelerations(n);
    compute_accelerations_inplace(positions, accelerations);
    return accelerations;
}

void NBodySystem::step_symplectic_verlet(double dt) {
    const std::size_t n = bodies_.size();
    if (n == 0) return;

    // Ensure persistent buffers are allocated
    if (!acc_cached_ || cur_acc_.size() != n) {
        cur_acc_.resize(n);
        scratch_pos_.resize(n);
        scratch_acc_.resize(n);
        for (std::size_t i = 0; i < n; ++i) {
            scratch_pos_[i] = bodies_[i].position;
        }
        compute_accelerations_inplace(scratch_pos_, cur_acc_);
        acc_cached_ = true;
    }

    const double half_dt_sq = 0.5 * dt * dt;
    const double half_dt = 0.5 * dt;

    // 1. Position update: r(t + dt) = r(t) + v(t)*dt + 0.5*a(t)*dt^2
    for (std::size_t i = 0; i < n; ++i) {
        scratch_pos_[i] = bodies_[i].position + bodies_[i].velocity * dt + cur_acc_[i] * half_dt_sq;
        bodies_[i].position = scratch_pos_[i];
    }

    // 2. Compute a(t + dt) only once per step!
    compute_accelerations_inplace(scratch_pos_, scratch_acc_);

    // 3. Velocity update: v(t + dt) = v(t) + 0.5*(a(t) + a(t + dt))*dt
    for (std::size_t i = 0; i < n; ++i) {
        bodies_[i].velocity += (cur_acc_[i] + scratch_acc_[i]) * half_dt;
    }

    // 4. Cache acceleration for the next step (eliminates 50% redundant calculations)
    std::swap(cur_acc_, scratch_acc_);
}

void NBodySystem::step_rk4(double dt) {
    const std::size_t n = bodies_.size();
    if (n == 0) return;

    // Store state: r0, v0
    std::vector<Vec3> r0(n);
    std::vector<Vec3> v0(n);
    for (std::size_t i = 0; i < n; ++i) {
        r0[i] = bodies_[i].position;
        v0[i] = bodies_[i].velocity;
    }

    // k1
    const auto k1_v = compute_accelerations(r0);
    const auto& k1_r = v0;

    // k2
    std::vector<Vec3> r_k2(n);
    std::vector<Vec3> v_k2(n);
    for (std::size_t i = 0; i < n; ++i) {
        r_k2[i] = r0[i] + k1_r[i] * (0.5 * dt);
        v_k2[i] = v0[i] + k1_v[i] * (0.5 * dt);
    }
    const auto k2_v = compute_accelerations(r_k2);
    const auto& k2_r = v_k2;

    // k3
    std::vector<Vec3> r_k3(n);
    std::vector<Vec3> v_k3(n);
    for (std::size_t i = 0; i < n; ++i) {
        r_k3[i] = r0[i] + k2_r[i] * (0.5 * dt);
        v_k3[i] = v0[i] + k2_v[i] * (0.5 * dt);
    }
    const auto k3_v = compute_accelerations(r_k3);
    const auto& k3_r = v_k3;

    // k4
    std::vector<Vec3> r_k4(n);
    std::vector<Vec3> v_k4(n);
    for (std::size_t i = 0; i < n; ++i) {
        r_k4[i] = r0[i] + k3_r[i] * dt;
        v_k4[i] = v0[i] + k3_v[i] * dt;
    }
    const auto k4_v = compute_accelerations(r_k4);
    const auto& k4_r = v_k4;

    // Final RK4 combination: r = r0 + (dt/6)*(k1 + 2*k2 + 2*k3 + k4)
    const double sixth_dt = dt / 6.0;
    for (std::size_t i = 0; i < n; ++i) {
        bodies_[i].position = r0[i] + (k1_r[i] + 2.0 * k2_r[i] + 2.0 * k3_r[i] + k4_r[i]) * sixth_dt;
        bodies_[i].velocity = v0[i] + (k1_v[i] + 2.0 * k2_v[i] + 2.0 * k3_v[i] + k4_v[i]) * sixth_dt;
    }
}

void NBodySystem::step(double dt, IntegratorType type) {
    if (type == IntegratorType::SymplecticVerlet) {
        step_symplectic_verlet(dt);
    } else {
        step_rk4(dt);
    }
}

std::vector<NBodySystem::TrajectorySnapshot> NBodySystem::simulate(
    double total_time, double dt, IntegratorType type, std::size_t snapshot_interval) {
    
    std::vector<TrajectorySnapshot> snapshots;
    if (dt <= 0.0 || total_time <= 0.0) return snapshots;

    const auto num_steps = static_cast<std::size_t>(std::ceil(total_time / dt));
    snapshots.reserve(num_steps / snapshot_interval + 1);

    auto record_snapshot = [&](double t) {
        TrajectorySnapshot snap;
        snap.time = t;
        snap.total_energy = total_energy();
        snap.center_of_mass = center_of_mass();
        snap.positions.reserve(bodies_.size());
        snap.velocities.reserve(bodies_.size());
        for (const auto& b : bodies_) {
            snap.positions.push_back(b.position);
            snap.velocities.push_back(b.velocity);
        }
        snapshots.push_back(std::move(snap));
    };

    record_snapshot(0.0);

    for (std::size_t step_idx = 1; step_idx <= num_steps; ++step_idx) {
        step(dt, type);
        if (step_idx % snapshot_interval == 0) {
            record_snapshot(step_idx * dt);
        }
    }

    return snapshots;
}

} // namespace orbisim
