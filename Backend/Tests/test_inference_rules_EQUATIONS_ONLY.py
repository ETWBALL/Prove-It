from Backend.inference_rules import *
from Backend.make import *

def test_IR_common_algebra():
    eqn1 = make_equation("(a)*(2) = (b)*(2)")
    eqn2 = make_equation("(5)+((a)*(2)) = ((b)*(2))+(5)") # Add 5 to both sides
    assert IR_common_algebra(eqn1, eqn2) == True


    eqn2 = make_equation("(5)-((a)*(2)) = ((b)*(2))+(5)") # Add 5 to both sides (purposeful mistake)
    assert IR_common_algebra(eqn1, eqn2) == False

    eqn2 = make_equation("(a)+(a) = (b) + (b)")
    assert IR_common_algebra(eqn1, eqn2) == True   # Test expansion

    eqn1 = make_equation("(a)*((b)+(2)) = 4")
    eqn2 = make_equation("((a)*(b))+((2)*(a)) = 4")
    assert IR_common_algebra(eqn1, eqn2) == True # Test distributions

    eqn2 = make_equation("(4)+(((a)*(b))+((2)*(a))) = 8")
    assert IR_common_algebra(eqn1, eqn2) == True   # Test distributions + adding to both sides

    eqn1 = make_equation("(a)/(b) = c")
    eqn2 = make_equation("((a)/(b)) + (4) = (c) + (4)")
    assert IR_common_algebra(eqn1, eqn2) == True   # Should work for divisions as well

    eqn2 = make_equation("((a)/(b)) + (4) = (c) + (2)")
    assert IR_common_algebra(eqn1, eqn2) == False   # Should work for divisions as well (purposeful mistake)





if __name__ == '__main__':
    import pytest
    pytest.main(['test_inference_rules_EQUATIONS_ONLY.py'])