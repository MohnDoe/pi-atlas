# Pre-computed StatsSummary for all time ranges

**Phase 1 note (PRD-0003):** Summaries are still pre-computed on open for the unfiltered case. Phase 2 dynamic filtering will compute on-the-fly. The `SessionAgg[]` array is small enough (<10k entries) that on-the-fly computation takes <10ms.

The Dashboard constructor computes `StatsSummary` for all four time ranges (1d, 7d, 30d, All) upfront, then passes the full array to every tab. Tabs read from the summary corresponding to the currently selected range.

This means every tab switch is instant — no computation needed — at the cost of holding four summaries in memory simultaneously (each ~tens of KB for a typical user). The alternative would compute summaries lazily on tab switch or range change, keeping only the current range's summary in memory.

**Trade-off**: For a typical user with hundreds of DayAgg entries, the memory overhead of four summaries is negligible (JSON-serialized cache is typically <500 KB). The latency benefit is real: tab switches happen in a single render cycle with no async work. The only scenario where lazy evaluation would help is an extremely large session history (>10k days), which is unlikely given pi's typical usage.

**Consequences**: The Dashboard constructor accepts `StatsSummary[]` (length 4) rather than `DayAgg[]`. Adding a new time range requires building a fifth summary. The summaries are recomputed only when the Dashboard is reconstructed (i.e., on range change via `buildTabs()`).
