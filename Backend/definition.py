from __future__ import annotations
from typing import Union, Any
from sympy import *
from propositions import Predicate

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


