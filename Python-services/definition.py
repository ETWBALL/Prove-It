from __future__ import annotations
from typing import Union, Any
from sympy import *
from propositions import *

class Definition:
    """
    A definition of <object>

    ==Public Attributes==

    object: What this definition is for
    name: the object's new label
    property: the object's new property
    condition: a predicate yet to be called <name>
    property_objects: any objects the predicate needs (i.e., variables, sets, functions etc.)
    latex_form: shows the bi condition arrows (useful for definition unfolding)
    """
    object: Any

    name: Union[None, str]
    property: Union[None, str]

    condition: Predicate
    property_objects: list[Any]

    latex_form: str

    def __init__(self, thing, name, property, condition, property_objects, latex_form) -> None:
        self.object = thing
        self.name = name
        self.property = property
        self.condition = condition
        self.property_objects = property_objects
        self.latex_form = latex_form

    def print_definition(self) -> None:
        second = None
        if self.name is None:
            second = self.property
        elif self.property is None:
            second = self.name

        # TODO fix self.condition root for predicate. It shows an error when referencing the root attribute
        print(f"An {self.object} is called {second} if {self.condition} is satisfied.")

def make_proposition(full_proposition: list) -> Proposition:
    """
    Recursion to build a specific Proposition tree (Binary, Unary, Equation) for .evaluate()
    """
    # Base Case: Single element (Atomic proposition or Truth value)
    if len(full_proposition) == 1:
        return Proposition(full_proposition[0], None, None, None)

    # Recursive Case: Operator in the middle (e.g., [P, 'and', Q])
    else:
        left = make_proposition(full_proposition[0])
        right = make_proposition(full_proposition[2])
        operator = full_proposition[1].strip()

        # if equation
        if operator == "=":
            return Equation(left, right)
            
        # if connective (and, or, implies)
        elif operator in [And.strip(), Or.strip(), Implies.strip(), if_and_only_if.strip()]:
            return Binary_Connective(left, right, full_proposition[1])
            
        else:
            return Proposition(operator, left, right, None)

def make_predicate_tree(full_proposition: list):
    pass