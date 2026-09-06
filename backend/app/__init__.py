"""FastAPI transport for the FairSlip engines.

This package computes nothing. It parses JSON into established Facts, hands them to
fairslip.rules / fairslip.cpf, and serialises what those engines return. Any number a
client sees came out of an engine.
"""
