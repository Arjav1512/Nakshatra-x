"""
MOIL Smart Ore Blending & Grade Optimization Engine
Solves multi-stockpile linear programming optimization to meet customer
grade specifications (Mn, P, SiO2, Fe) with minimum cost during shortfall periods.
"""

from typing import List, Dict, Any
import numpy as np
from scipy.optimize import linprog


class StockpileSource:
    def __init__(
        self,
        name: str,
        available_tonnes: float,
        mn_grade_pct: float,
        p_pct: float,
        sio2_pct: float,
        cost_per_tonne_inr: float,
    ):
        self.name = name
        self.available_tonnes = available_tonnes
        self.mn_grade_pct = mn_grade_pct
        self.p_pct = p_pct
        self.sio2_pct = sio2_pct
        self.cost_per_tonne_inr = cost_per_tonne_inr


def optimize_ore_blend(
    target_tonnes: float,
    target_mn_min: float,
    target_p_max: float,
    target_sio2_max: float,
    stockpiles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Formulates and solves Linear Programming problem:
    Minimize Total Cost = sum(cost_i * x_i)
    Subject to:
      sum(x_i) = target_tonnes
      sum(mn_i * x_i) >= target_mn_min * target_tonnes  ==> -sum(mn_i * x_i) <= -target_mn_min * target_tonnes
      sum(p_i * x_i) <= target_p_max * target_tonnes
      sum(sio2_i * x_i) <= target_sio2_max * target_tonnes
      0 <= x_i <= available_i
    """
    n = len(stockpiles)
    if n == 0:
        return {"success": False, "message": "No stockpiles provided"}

    costs = [s["cost_per_tonne_inr"] for s in stockpiles]
    avail = [s["available_tonnes"] for s in stockpiles]
    mn_grades = [s["mn_grade_pct"] for s in stockpiles]
    p_pcts = [s["p_pct"] for s in stockpiles]
    sio2_pcts = [s["sio2_pct"] for s in stockpiles]

    # Inequality constraints A_ub * x <= b_ub
    A_ub = [
        [-g for g in mn_grades],        # -Mn >= -target_mn
        p_pcts,                         # P <= target_p
        sio2_pcts,                      # SiO2 <= target_sio2
    ]
    b_ub = [
        -target_mn_min * target_tonnes,
        target_p_max * target_tonnes,
        target_sio2_max * target_tonnes,
    ]

    # Equality constraint sum(x_i) = target_tonnes
    A_eq = [[1.0] * n]
    b_eq = [target_tonnes]

    # Bounds for each stockpile
    bounds = [(0, min(avail[i], target_tonnes)) for i in range(n)]

    res = linprog(
        c=costs,
        A_ub=A_ub,
        b_ub=b_ub,
        A_eq=A_eq,
        b_eq=b_eq,
        bounds=bounds,
        method="highs",
    )

    if not res.success:
        # INFEASIBLE.
        #
        # This branch previously ran a pro-rata heuristic that ignored the
        # grade constraints and returned success: True. Asked for 50% Mn from
        # stockpiles peaking at 46.2%, it answered "success" with a 41.1% blend
        # — proposing a plan that cannot physically meet the spec.
        #
        # Constraints are enforced, not negotiated. An unsatisfiable spec is
        # reported as unsatisfiable, with a diagnosis of what IS achievable so
        # the planner can relax the right constraint.
        total_avail = sum(avail)
        if total_avail == 0:
            return {
                "success": False,
                "solver_status": "Infeasible",
                "message": "Zero available stockpile inventory",
            }
        if total_avail < target_tonnes:
            return {
                "success": False,
                "solver_status": "Infeasible",
                "message": (
                    f"Insufficient inventory: {round(total_avail, 1)} t available "
                    f"against a {round(target_tonnes, 1)} t requirement."
                ),
                "diagnostics": {"available_tonnes": round(total_avail, 1)},
            }

        # Diagnose: what is the best Mn grade reachable while still honouring
        # the contaminant limits? Maximising Mn == minimising -Mn.
        diag = linprog(
            c=[-g for g in mn_grades],
            A_ub=[p_pcts, sio2_pcts],
            b_ub=[target_p_max * target_tonnes, target_sio2_max * target_tonnes],
            A_eq=A_eq,
            b_eq=b_eq,
            bounds=bounds,
            method="highs",
        )

        if diag.success:
            max_mn = -float(diag.fun) / target_tonnes
            message = (
                f"Specification unsatisfiable: the highest Mn grade achievable "
                f"within the P and SiO2 limits is {round(max_mn, 2)}%, below the "
                f"{target_mn_min}% required."
            )
            diagnostics = {
                "max_achievable_mn_pct": round(max_mn, 2),
                "required_mn_pct": target_mn_min,
                "binding_constraint": "target_mn_min",
                "richest_stockpile_mn_pct": round(max(mn_grades), 2),
            }
        else:
            message = (
                "Specification unsatisfiable: the phosphorus and silica limits "
                "cannot be met simultaneously by any blend of the available "
                "stockpiles at the required tonnage."
            )
            diagnostics = {
                "binding_constraint": "target_p_max / target_sio2_max",
                "lowest_p_pct": round(min(p_pcts), 3),
                "lowest_sio2_pct": round(min(sio2_pcts), 2),
            }

        # A best-effort blend is still useful to a planner, but it is returned
        # under success: False and explicitly marked as not meeting spec, so it
        # can never be mistaken for an executable plan.
        best_effort = []
        achieved_mn = achieved_p = achieved_sio2 = total_cost = 0.0
        for st in stockpiles:
            fraction = st["available_tonnes"] / total_avail
            tonnes = fraction * target_tonnes
            cost = tonnes * st["cost_per_tonne_inr"]
            achieved_mn += fraction * st["mn_grade_pct"]
            achieved_p += fraction * st["p_pct"]
            achieved_sio2 += fraction * st["sio2_pct"]
            total_cost += cost
            best_effort.append({
                "stockpile_name": st["name"],
                "tonnes_allocated": round(tonnes, 1),
                "allocation_pct": round(fraction * 100, 1),
                "cost_inr": round(cost, 2),
            })

        return {
            "success": False,
            "solver_status": "Infeasible",
            "message": message,
            "diagnostics": diagnostics,
            "best_effort_blend": {
                "meets_spec": False,
                "warning": "Does NOT meet the requested specification. Not an executable plan.",
                "blended_mn_grade_pct": round(achieved_mn, 2),
                "blended_p_pct": round(achieved_p, 3),
                "blended_sio2_pct": round(achieved_sio2, 2),
                "avg_cost_per_tonne_inr": round(total_cost / target_tonnes, 2) if target_tonnes else 0,
                "blend_plan": best_effort,
            },
        }

    x = res.x
    total_cost = float(res.fun)
    achieved_mn = sum(mn_grades[i] * x[i] for i in range(n)) / target_tonnes
    achieved_p = sum(p_pcts[i] * x[i] for i in range(n)) / target_tonnes
    achieved_sio2 = sum(sio2_pcts[i] * x[i] for i in range(n)) / target_tonnes

    blend_plan = []
    for i in range(n):
        tonnes = float(x[i])
        blend_plan.append({
            "stockpile_name": stockpiles[i]["name"],
            "tonnes_allocated": round(tonnes, 1),
            "allocation_pct": round((tonnes / target_tonnes) * 100, 1) if target_tonnes else 0,
            "cost_inr": round(tonnes * costs[i], 2),
        })

    return {
        "success": True,
        "solver_status": "Simplex Optimal Solution Found",
        "target_tonnes": target_tonnes,
        "blended_mn_grade_pct": round(achieved_mn, 2),
        "blended_p_pct": round(achieved_p, 3),
        "blended_sio2_pct": round(achieved_sio2, 2),
        "total_blending_cost_inr": round(total_cost, 2),
        "avg_cost_per_tonne_inr": round(total_cost / target_tonnes, 2) if target_tonnes else 0,
        "blend_plan": blend_plan,
        "shortfall_mitigation_tonnes": round(target_tonnes, 1),
    }
