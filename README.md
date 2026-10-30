# Database Load Testing & Optimization

## Section 1: Load Testing Baseline

### 1.1 Overview

This section documents the initial write and read load tests performed against the database to establish a performance baseline.

The objective was to measure:

- Write throughput under different batch sizes and worker counts.
- Read throughput against a multi-million-document dataset.
- Query latency under increasing concurrency.
- Performance changes as workload volume increases.
- Errors and operation completion rates during testing.

These benchmarks provide a baseline for future database optimization, scaling experiments, and log analytics performance testing.

### 1.2 Test Environment

| Parameter | Value |
|---|---|
| Runtime | Node.js |
| Database | Existing project database |
| Write test runner | `usageTest.js` |
| Read test runner | `testRead.js` |
| Dataset size during read tests | 2,411,005 documents |
| Write batch sizes tested | 100, 500, 1,000 |
| Maximum write volume | 1,000,000 records |
| Maximum read query volume | 1,000,000 queries |
| Maximum tested worker count | 64 |

**Note:** Database version, hardware specifications, indexes, connection-pool configuration, and resource utilization were not recorded in the supplied benchmark results. These details should be documented before making production capacity claims.

### 1.3 Write Load Testing Results

The write benchmark evaluated different record counts and worker configurations.

| Profile | Records | Workers | Batch Size | Insert Time | Throughput |
|---|---:|---:|---:|---:|---:|
| Sanity | 1,000 | 1 | 100 | 131.98 ms | 7,577 records/s |
| Light | 10,000 | 2 | 500 | 599.12 ms | 16,691 records/s |
| Medium | 50,000 | 4 | 1,000 | 2.23 s | 22,437 records/s |
| Heavy | 100,000 | 8 | 1,000 | 5.16 s | 19,367 records/s |
| Stress | 250,000 | 16 | 1,000 | 12.24 s | 20,421 records/s |
| Repeatability | 250,000 | 8 | 1,000 | 12.90 s | 19,375 records/s |
| Concurrency A | 250,000 | 16 | 1,000 | 12.31 s | 20,308 records/s |
| Concurrency B | 250,000 | 32 | 1,000 | 13.00 s | 19,233 records/s |
| Concurrency C | 250,000 | 64 | 1,000 | 13.46 s | 18,569 records/s |
| Volume Test | 1,000,000 | 16 | 1,000 | 62.37 s | 16,034 records/s |

**Observed results**

- All requested records were reported as successfully inserted.
- The highest measured write throughput was approximately **22,437 records/sec**, achieved in the Medium profile.
- The one-million-record test completed in approximately **63.59 seconds**, including record generation.
- Increasing the worker count from 16 to 32 and 64 did not improve throughput in the tested configurations.
- The one-million-record test achieved lower throughput than the smaller tests, indicating that performance should also be evaluated at larger dataset volumes.

These results establish measured write performance for the current test implementation. They do not establish the database's maximum production capacity.

### 1.4 Read Load Testing Results

The read benchmark executed queries against a dataset containing 2,411,005 documents.

| Profile | Queries | Workers | Result Limit | QPS | p95 Latency | p99 Latency |
|---|---:|---:|---:|---:|---:|---:|
| Sanity | 1,000 | 1 | 50 | 918 | 1.90 ms | 2.83 ms |
| Light | 10,000 | 2 | 50 | 2,484 | 1.35 ms | 1.84 ms |
| Medium | 50,000 | 4 | 50 | 3,625 | 1.76 ms | 2.56 ms |
| Heavy | 100,000 | 8 | 100 | 3,479 | 3.79 ms | 6.30 ms |
| Stress | 250,000 | 16 | 100 | 3,665 | 7.94 ms | 12.65 ms |
| Repeatability | 250,000 | 8 | 100 | 3,138 | 4.51 ms | 7.82 ms |
| Concurrency A | 250,000 | 16 | 100 | 3,747 | 7.48 ms | 11.88 ms |
| Concurrency B | 250,000 | 32 | 100 | 3,668 | 14.96 ms | 20.13 ms |
| Concurrency C | 250,000 | 64 | 100 | 3,376 | 32.91 ms | 41.62 ms |
| Volume Test | 1,000,000 | 16 | 100 | 3,076 | 10.36 ms | 18.10 ms |

**Observed results**

- All queries were reported as completed, with zero reported errors across the supplied profiles.
- The highest measured throughput was approximately **3,747 queries/sec**, achieved with 16 workers.
- The one-million-query test completed in approximately **325.08 seconds**, with a measured throughput of 3,076 queries/sec.
- The 64-worker test achieved lower throughput and higher tail latency than the 16-worker test.
- The one-million-query test maintained zero reported errors, but throughput decreased compared with the 250,000-query concurrency test.

The result limit is the configured maximum per query, not the actual average number of returned documents. The tests reported approximately 35–43 returned documents per query on average.

### 1.5 Concurrency Analysis

The 250,000-query tests provide a useful comparison of worker counts under a broadly similar workload.

| Workers | Queries/sec | p99 Latency |
|---:|---:|---:|
| 8 | 3,138 | 7.82 ms |
| 16 | 3,747 | 11.88 ms |
| 32 | 3,668 | 20.13 ms |
| 64 | 3,376 | 41.62 ms |

**Key findings**

1. Throughput improved when increasing concurrency from 8 to 16 workers in the reported runs.
2. Increasing concurrency beyond 16 workers did not produce additional throughput improvements.
3. At 64 workers, p99 latency increased to 41.62 ms.
4. The results suggest diminishing returns at higher concurrency and possible resource contention.

Sixteen workers performed best among the tested read configurations for peak throughput. This is a benchmark observation, not a universal optimal worker count.

The underlying bottleneck has not yet been identified. Possible causes include database resource saturation, connection-pool contention, query execution costs, or application-side overhead.

### 1.6 Initial Conclusions

The initial benchmarks establish the following baseline:

- **Write throughput:** Up to approximately 22.4K records/sec in the tested workloads.
- **Large-volume writes:** One million records inserted successfully in approximately 63.6 seconds of total test time.
- **Read throughput:** Up to approximately 3.75K queries/sec in the tested workloads.
- **Large-volume reads:** One million queries completed successfully against the existing dataset.
- **Error handling:** Zero reported failed operations in the supplied results.
- **Concurrency:** Increasing workers beyond 16 did not improve measured throughput in the tested read and write configurations.

These results are encouraging for continued development of the Usage DB. However, they do not yet prove production readiness or establish a maximum supported workload.

### 1.7 Limitations and Next Steps

The following areas remain unverified:

- Database CPU, memory, disk I/O, and connection-pool utilization.
- Actual database version, hardware configuration, and index definitions.
- Sustained load and performance stability over longer durations.
- Mixed read/write workloads.
- Query execution plans and scanned-versus-returned document counts.
- Realistic historical log queries covering 7, 30, and 90 days.
- Aggregations for token consumption, costs, errors, and request latency.
- Behaviour under database failures, timeouts, and connection interruptions.

Future sections will document these tests separately so that benchmark results and architecture decisions can be compared over time.