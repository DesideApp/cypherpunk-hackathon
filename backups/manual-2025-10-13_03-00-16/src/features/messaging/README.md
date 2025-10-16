# Messaging Feature Overview

This module now provides the minimal pieces needed for the chat MVP:

- `hooks/useMessaging` – orchestrates message retrieval and sending (Relay + RTC fallback).
- `clients/relayClient` – thin HTTP helpers for enqueue/fetch/ack.
- `ui/` – list, chat window and message bubbles (texto puro).
- `store/messagesStore` – in-memory cache for the current session.

Attachments, presence indicators y señalización de "typing" fueron retirados para simplificar el flujo.
