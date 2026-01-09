from .rules import (
    InferenceRule,
    ModusPonens, modus_ponens,
    ModusTollens, modus_tollens,
    HypotheticalSyllogism, hypothetical_syllogism,
    DisjunctiveSyllogism, disjunctive_syllogism,
    Addition, addition,
    Simplification, simplification,
    Conjunction, conjunction,
    Resolution, resolution
)

from .quantifier_rules import (
    UniversalInstantiation, universal_instantiation,
    UniversalGeneralization, universal_generalization,
    ExistentialInstantiation, existential_instantiation,
    ExistentialGeneralization, existential_generalization,
    QuantifierNegation, quantifier_negation
)