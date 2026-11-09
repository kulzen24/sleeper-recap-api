from typing import NoReturn


class ApiError(Exception):
    """A typed error carrying the HTTP status that should be sent to the
    client. Raised from anywhere in the request pipeline and turned into a
    JSON error body by the error handler in app.py."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def bad_request(message: str) -> NoReturn:
    raise ApiError(message, 400)
