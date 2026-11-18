"""indiasim: the Economy Lab agent-based model of the Indian economy, for Python.

It runs the same engine as the website (https://slxnjdhv.github.io/india-economy-simulator/),
so the same economy number gives the same results, month for month.

Quick start::

    import indiasim as isim
    df = isim.run(months=36, shocks=["monsoon"])          # one economy, RBI rule
    many = isim.run_many(seeds=range(1, 101), shocks=["oil"])
    sw = isim.sweep("repoDelta", [-0.01, 0, 0.01, 0.02], seeds=range(1, 41))
    isim.moments()                                          # model vs Indian data
"""
from .core import (RUPEE_START, Economy, Game, calibration_targets, defaults, india_data, moments, run,
                   run_many, scenarios, shocks, sweep)

__version__ = "0.1.0"
__all__ = ["run", "run_many", "sweep", "Economy", "Game", "moments", "calibration_targets", "india_data",
           "defaults", "scenarios", "shocks", "RUPEE_START", "__version__"]
