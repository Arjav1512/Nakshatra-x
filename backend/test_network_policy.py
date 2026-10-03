"""
The network policy in backend/conftest.py is in force (THE NETWORK).

These run in every session, CI's included, so "the required jobs cannot depend
on an external service" is checked rather than assumed.
"""
import socket
import threading

import pytest


def test_an_unmarked_test_cannot_reach_an_external_host():
    with pytest.raises(socket.gaierror, match="pytest.mark.network"):
        socket.getaddrinfo("power.larc.nasa.gov", 443)


def test_background_threads_are_offline_too():
    """The app's own threads (mosaic registration, forecast flights) included."""
    errors = []

    def reach():
        try:
            socket.getaddrinfo("planetarycomputer.microsoft.com", 443)
        except socket.gaierror as exc:
            errors.append(exc)

    t = threading.Thread(target=reach)
    t.start()
    t.join(5)
    assert errors and "pytest.mark.network" in str(errors[0])


def test_a_direct_connection_by_address_is_refused():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        with pytest.raises(ConnectionRefusedError, match="pytest.mark.network"):
            s.connect(("93.184.215.14", 443))
    finally:
        s.close()


def test_loopback_is_allowed():
    assert socket.getaddrinfo("localhost", 8000)
    assert socket.getaddrinfo("127.0.0.1", 8000)
