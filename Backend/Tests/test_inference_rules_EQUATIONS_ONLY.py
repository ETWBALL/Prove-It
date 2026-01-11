from math import *
from Backend.inference_rules import *
from Backend.make import *

def test_IR_common_algebra():
    eqn1 = make_equation("(a)*(2) = (b)*(2)")
    eqn2 = make_equation("(5)+((a)*(2)) = ((b)*(2))+(5)") # Add 5 to both sides
    assert IR_common_algebra(eqn1, eqn2) == True


    eqn2 = make_equation("(5)-((a)*(2)) = ((b)*(2))+(5)") # Add 5 to both sides (purposeful mistake)
    assert IR_common_algebra(eqn1, eqn2) == False







if __name__ == '__main__':
    import pytest
    pytest.main(['test_inference_rules_EQUATIONS_ONLY.py'])