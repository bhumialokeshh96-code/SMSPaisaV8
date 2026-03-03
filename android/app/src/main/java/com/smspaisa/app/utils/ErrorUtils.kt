package com.smspaisa.app.utils

import retrofit2.HttpException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Converts a raw exception into a safe, user-friendly error message.
 * NEVER exposes raw exception messages (which may contain server URLs or internal details).
 */
fun Throwable.toUserMessage(): String = when (this) {
    is UnknownHostException -> "No internet connection. Please check your network."
    is SocketTimeoutException -> "Connection timed out. Please try again."
    is ConnectException -> "Unable to connect. Please try again later."
    is HttpException -> when (code()) {
        401  -> "Session expired. Please login again."
        403  -> "Access denied."
        404  -> "Requested data not found."
        422  -> "Invalid input. Please check your details."
        429  -> "Too many requests. Please wait a moment."
        500, 502, 503, 504 -> "Server is temporarily unavailable. Please try again later."
        else -> "Something went wrong. Please try again."
    }
    else -> "Something went wrong. Please try again."
}
