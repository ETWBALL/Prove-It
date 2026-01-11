from make import *

def test_equation_creation():
    eqn1 = make_equation("(a)*(2) = (b)*(2)")
    assert eqn1.__str__() == "(a) * (2) = (b) * (2)"

    eqn2 = make_equation("(((a)*((x)^(2))) + ((b)*(x))) + (c) = 0")
    assert eqn2.__str__() == "(((a) * ((x)^(2))) + ((b) * (x))) + (c) = 0"


if __name__ == '__main__':
    import pytest
    pytest.main(['test_expressions.py'])