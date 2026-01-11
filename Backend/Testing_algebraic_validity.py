from __future__ import annotations
from typing import Any

from sympy import *


def proposition_equations_validity(P1: str, P2: str) -> bool:
    """
    Given two propositions, check if P2 can be derived from P1.

    :param P1: equation 1
    :param P2: equation 2
    :return: if equation 1 and equation 2 are equal
    """
    exp11, exp12 = P1.split('=')
    exp21, exp22 = P2.split('=')

    exp11, exp12, exp21, exp22 = sympify(exp11), sympify(exp12), sympify(exp21), sympify(exp22)

    final = (exp11-exp12)-(exp21-exp22)

    return simplify(final)==0

if __name__ == "__main__":
    # 1. Works for adding and subtracting terms
    # 2. Works for polynomial expansions
    # 3. Distributing things
    # 'a*x**2 + b*x + c = 0'
    # 'x**2 - b*x/a - c/a = 0'

    proposition1 = '(a)*(2) = (b)*(2)'
    proposition2 =  '(a)*(2) = (b)*(2)'
    print(proposition_equations_validity(proposition1, proposition2))


