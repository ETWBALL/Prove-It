from sympy import *
from propositions import *
from sympy import *


def IR_common_algebra(eqn1: Equation, eqn2: Equation) -> bool:
    """
    Given two equations, return true if eq2 is obtainable from eqn1. Else, return false
    This function works for the following:

    - Expansions
    - Distributing Values
    - Simplification

    === Parameters ===
    eqn1: An equation tree with left and right expressions. This is the premise
    eqn2: An equation tree with left and right expressions. This is the conclusion
    """


    exp11, exp12, exp21, exp22 = (sympify(str(eqn1.left)),
                                  sympify(str(eqn1.right)),
                                  sympify(str(eqn2.left)),
                                  sympify(str(eqn2.right)))

    final = (exp11-exp12)-(exp21-exp22)
    return simplify(final)==0


def IR_division_by_nonzero(premise: Equation, conclusion: Equation) -> bool:
    """
    Return true if the concluding expression is the valid conclusion from eqn1 (the premise), using division by nonzero
    """
    # Make two equations, with premise on one side and conclusion on the other
    solver = Symbol('solver', nonzero=True)
    eqn1 = Eq(sympify(str(premise.left))/solver, sympify(str(conclusion.left)))
    eqn2 = Eq(sympify(str(premise.right))/solver, sympify(str(conclusion.right)))

    soln1 = solve(eqn1, solver)
    soln2 = solve(eqn2, solver)

    # Ensure the solutions are the same.
    if soln1 == soln2:
        # Then check if the solution is nonzero. Check in the premise
        solution = str(soln1[0])
        return True

    return False

