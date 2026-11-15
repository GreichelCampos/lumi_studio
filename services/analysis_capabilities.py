"""Translate real semantic-analysis capability into public limitations."""

from .results import AnalysisLimitation


def analysis_limitations(
    *, spatial_analysis_complete: bool,
) -> tuple[AnalysisLimitation, ...]:
    """Report only a genuine partial spatial semantic result."""

    if spatial_analysis_complete:
        return ()
    return (AnalysisLimitation.SPATIAL_SEMANTICS_UNAVAILABLE,)
