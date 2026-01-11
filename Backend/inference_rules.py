from sympy import *
from propositions import *

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


def IR_division_by_nonzero(eqn1: Eq, eqn2: Eq) -> bool:
    """
    Return true if eqn 2 is the valid conclusion from eqn1, using division by nonzero
    """
    #TODO Make this once equation class is done