from Variables import *

def test_variables_initialization_assignment():
    x = Variable('x')
    x.assign(3)
    assert x.assignment == 3   #x=3

    x.assign(-3)
    assert x.assignment == -3   #x=-3

    x.assign(0)
    assert x.assignment == 0    #x=0


def test_make_variable():
    x = make_variable('x') #TODO must be initialized

    y = make_variable('y=4')
    assert y.assignment == 4 #y=4

    z = make_variable('z=-334')
    assert z.assignment == -334 #z=-334

def test_variable_prints_assignments():
    x = make_variable('x=5')
    assert x.__str__() == 'x = 5'


if __name__ == '__main__':
    import pytest
    pytest.main(['test_Variables.py'])