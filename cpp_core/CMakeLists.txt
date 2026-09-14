cmake_minimum_required(VERSION 3.20)
project(OrbiSimCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler Optimization and OpenMP flags
find_package(OpenMP REQUIRED)

# Core Library
add_library(orbisim_core STATIC
    src/nbody_solver.cpp
)

target_compile_options(orbisim_core PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:
        -O3
        -march=native
        -fno-math-errno
        -fno-trapping-math
        -ffp-contract=fast
        -Wall
        -Wextra
        -Wpedantic
    >
)

target_include_directories(orbisim_core PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

target_link_libraries(orbisim_core PUBLIC
    OpenMP::OpenMP_CXX
)

# Testing with GoogleTest
enable_testing()

include(FetchContent)
FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

add_executable(test_nbody
    tests/test_nbody.cpp
)

target_link_libraries(test_nbody PRIVATE
    orbisim_core
    GTest::gtest_main
)

include(GoogleTest)
gtest_discover_tests(test_nbody)
