from __future__ import annotations
from typing import Union
from Sets import Set
from sympy import Symbol
from Propositions import Proposition

class Variable:
    """
    One of the primary mathematical objects used in proofs.

    ==Public Attributes==
    name: The name/symbol of the variable.
    domain: The domain of the variable, i.e., where the variable comes from
    assignment: What object the variable is assigned to, i.e., int, function, set i.e.,
    """
    name: str
    domain: Union[Set, None]
    assignment: Union[int, None]
    Properties: list[Proposition]
    _Sy_var: Symbol

    def __init__(self, name: str) -> None:
        self.name = name
        self.domain = None
        self.assignment = None
        self._Sy_var = Symbol(name)
        self.Properties = []

    def assign(self, value: int) -> None:
        """
        Assigns the value to the variable.
        """
        self.assignment = value
        # TODO check if assignment matches with domain, otherwise, raise an error

    def define_domain(self, domain: Set) -> None:
        self.domain = domain

    def __str__(self):
        if (self.assignment is not None) and (self.domain is not None):
            return f"{self.name} ∈ {self.domain}, {self.name} = {self.assignment}"
        if self.assignment is not None:
            return f"{self.name} = {self.assignment}"
        else:
            return f"{self.name} ∈ {self.domain}"


def make_variable(expression: str) -> Variable:
    split = expression.split("=")

    # variable is part of a "known" domain
    if len(split) != 2:
        pass

    else:
        var = Variable(split[0])
        var.assign(int(split[1]))
        return var


