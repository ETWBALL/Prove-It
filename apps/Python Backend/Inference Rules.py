from sympy import *

def division_by_nonzero(eqn1: Eq, eqn2: Eq) -> bool:
    """
    Return true if eqn 2 is the valid conclusion from eqn1, using division by nonzero
    """
    #TODO Make this once equation class is done