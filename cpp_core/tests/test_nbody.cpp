#include <gtest/gtest.h>
#include "nbody_solver.hpp"
#include <cmath>
#include <numbers>

using namespace astrodynamics;

// Fixture for a two-body Sun-Planet system
class TwoBodyTest : public ::testing::Test {
protected:
    void SetUp() override {
        system = NBodySystem(1.0, 1e-6);
        // Central star (massive) at origin
        system.add_body(Body{"Star", 1000.0, {0.0, 0.0, 0.0}, {0.0, -0.01, 0.0}});
        // Planet in circular orbit at r = 10.0: v = sqrt(G * M / r) = sqrt(1000 / 10) = 10.0
        // Adjust star velocity for zero total linear momentum: 1000 * v_star + 1.0 * 10.0 = 0 -> v_star = -0.01
        system.add_body(Body{"Planet", 1.0, {10.0, 0.0, 0.0}, {0.0, 10.0, 0.0}});
    }

    NBodySystem system;
};

// Fixture for a symmetric Three-body system
class ThreeBodyTest : public ::testing::Test {
protected:
    void SetUp() override {
        system = NBodySystem(1.0, 1e-5);
        // Equilateral triangle configuration with equal masses in exact circular equilibrium
        const double r = 5.0;
        const double m = 10.0;
        const double v_circ = std::sqrt((1.0 * m) / (std::sqrt(3.0) * r)); // ~1.07457
        const double theta1 = 0.0;
        const double theta2 = 2.0 * std::numbers::pi / 3.0;
        const double theta3 = 4.0 * std::numbers::pi / 3.0;

        system.add_body(Body{"Body1", m, {r * std::cos(theta1), r * std::sin(theta1), 0.0}, {-v_circ * std::sin(theta1), v_circ * std::cos(theta1), 0.0}});
        system.add_body(Body{"Body2", m, {r * std::cos(theta2), r * std::sin(theta2), 0.0}, {-v_circ * std::sin(theta2), v_circ * std::cos(theta2), 0.0}});
        system.add_body(Body{"Body3", m, {r * std::cos(theta3), r * std::sin(theta3), 0.0}, {-v_circ * std::sin(theta3), v_circ * std::cos(theta3), 0.0}});
    }

    NBodySystem system;
};

TEST_F(TwoBodyTest, ConservationOfCenterOfMassVelocityAndPosition) {
    const Vec3 cm_v0 = system.center_of_mass_velocity();
    const Vec3 cm_r0 = system.center_of_mass();

    EXPECT_NEAR(cm_v0.norm(), 0.0, 1e-12);

    const double dt = 0.001;
    const int steps = 2000;

    for (int i = 0; i < steps; ++i) {
        system.step_symplectic_verlet(dt);
    }

    const Vec3 cm_v_end = system.center_of_mass_velocity();
    const Vec3 cm_r_end = system.center_of_mass();

    EXPECT_NEAR(cm_v_end.x, cm_v0.x, 1e-8);
    EXPECT_NEAR(cm_v_end.y, cm_v0.y, 1e-8);
    EXPECT_NEAR(cm_v_end.z, cm_v0.z, 1e-8);

    EXPECT_NEAR(cm_r_end.x, cm_r0.x, 1e-6);
    EXPECT_NEAR(cm_r_end.y, cm_r0.y, 1e-6);
    EXPECT_NEAR(cm_r_end.z, cm_r0.z, 1e-6);
}

TEST_F(TwoBodyTest, SymplecticVerletEnergyConservation) {
    const double e0 = system.total_energy();
    EXPECT_LT(e0, 0.0); // Bound orbit

    const double dt = 0.001;
    const int steps = 5000;
    double max_rel_error = 0.0;

    for (int i = 0; i < steps; ++i) {
        system.step_symplectic_verlet(dt);
        const double e_curr = system.total_energy();
        const double rel_err = std::abs(e_curr - e0) / std::abs(e0);
        if (rel_err > max_rel_error) {
            max_rel_error = rel_err;
        }
    }

    // Symplectic Verlet energy error should remain strictly bounded (shadow Hamiltonian)
    EXPECT_LT(max_rel_error, 1e-4);
}

TEST_F(TwoBodyTest, RungeKutta4EnergyConservation) {
    const double e0 = system.total_energy();
    const double dt = 0.001;
    const int steps = 2000;

    for (int i = 0; i < steps; ++i) {
        system.step_rk4(dt);
    }

    const double e_final = system.total_energy();
    const double rel_err = std::abs(e_final - e0) / std::abs(e0);

    // RK4 has high 4th-order local accuracy
    EXPECT_LT(rel_err, 1e-6);
}

TEST_F(TwoBodyTest, TotalAngularMomentumConservation) {
    const Vec3 L0 = system.total_angular_momentum();
    const double dt = 0.002;
    const int steps = 2500;

    for (int i = 0; i < steps; ++i) {
        system.step_symplectic_verlet(dt);
    }

    const Vec3 L_final = system.total_angular_momentum();
    EXPECT_NEAR(L_final.x, L0.x, 1e-7);
    EXPECT_NEAR(L_final.y, L0.y, 1e-7);
    EXPECT_NEAR(L_final.z, L0.z, 1e-7);
}

TEST_F(ThreeBodyTest, ThreeBodyCenterOfMassAndEnergyConservation) {
    const double e0 = system.total_energy();
    const Vec3 p0 = system.total_linear_momentum();
    const Vec3 l0 = system.total_angular_momentum();

    const double dt = 0.001;
    const int steps = 3000;

    for (int i = 0; i < steps; ++i) {
        system.step_symplectic_verlet(dt);
    }

    const double e_final = system.total_energy();
    const Vec3 p_final = system.total_linear_momentum();
    const Vec3 l_final = system.total_angular_momentum();

    const double rel_energy_err = std::abs(e_final - e0) / std::abs(e0);
    EXPECT_LT(rel_energy_err, 5e-4);

    EXPECT_NEAR((p_final - p0).norm(), 0.0, 1e-7);
    EXPECT_NEAR((l_final - l0).norm(), 0.0, 1e-7);
}

TEST_F(TwoBodyTest, TrajectorySimulationSnapshotIntegrity) {
    const double total_time = 2.0;
    const double dt = 0.01;
    const auto snapshots = system.simulate(total_time, dt, IntegratorType::SymplecticVerlet, 5);

    EXPECT_GT(snapshots.size(), 10);
    EXPECT_EQ(snapshots.front().positions.size(), 2);
    EXPECT_EQ(snapshots.back().positions.size(), 2);

    // Initial time should be 0.0, final near 2.0
    EXPECT_NEAR(snapshots.front().time, 0.0, 1e-9);
    EXPECT_NEAR(snapshots.back().time, 2.0, 0.02);
}

TEST_F(TwoBodyTest, ZeroSofteningNoNan) {
    // Pure Newtonian interaction with zero softening must not produce NaN in self-interaction
    system.set_softening(0.0);
    const double dt = 0.001;

    for (int i = 0; i < 100; ++i) {
        system.step_symplectic_verlet(dt);
    }

    for (const auto& b : system.bodies()) {
        EXPECT_FALSE(std::isnan(b.position.x));
        EXPECT_FALSE(std::isnan(b.position.y));
        EXPECT_FALSE(std::isnan(b.position.z));
        EXPECT_FALSE(std::isnan(b.velocity.x));
        EXPECT_FALSE(std::isnan(b.velocity.y));
        EXPECT_FALSE(std::isnan(b.velocity.z));
    }
}

TEST_F(TwoBodyTest, IntegratorInterleavingCacheConsistency) {
    // Interleaving Verlet and RK4 must cleanly invalidate cached accelerations
    const double e0 = system.total_energy();
    const double dt = 0.001;

    system.step_symplectic_verlet(dt);
    system.step_rk4(dt);
    system.step_symplectic_verlet(dt);

    const double e_final = system.total_energy();
    const double rel_err = std::abs(e_final - e0) / std::abs(e0);
    EXPECT_LT(rel_err, 1e-5);
}

TEST_F(TwoBodyTest, AdaptiveTimeStepEccentricOrbit) {
    // Eccentric encounter test: compute_adaptive_dt should contract near pericenter
    const double base_dt = 0.01;
    const double dt_init = system.compute_adaptive_dt(base_dt, 0.08);
    EXPECT_GT(dt_init, 0.0);
    EXPECT_LE(dt_init, base_dt);

    // Integrate with adaptive sub-stepping over multiple steps
    for (int i = 0; i < 500; ++i) {
        system.step_adaptive(0.005, IntegratorType::SymplecticVerlet, 0.08);
    }

    const double min_dist = system.compute_min_distance();
    EXPECT_GT(min_dist, 5.0); // Orbit remains bound without numerical ejection
    EXPECT_LT(min_dist, 15.0);
}

TEST_F(TwoBodyTest, BarycentricResetMomentumConservation) {
    // Deliberately introduce momentum imbalance
    system.bodies()[0].velocity.x += 2.0;
    EXPECT_GT(system.total_linear_momentum().norm(), 100.0);

    // Reset barycenter drift
    system.reset_barycenter(true);

    EXPECT_NEAR(system.total_linear_momentum().norm(), 0.0, 1e-12);
    EXPECT_NEAR(system.center_of_mass_velocity().norm(), 0.0, 1e-12);
    EXPECT_NEAR(system.center_of_mass().norm(), 0.0, 1e-12);
}

