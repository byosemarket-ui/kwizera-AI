# AI Model Management

This module manages local AI model records, model lifecycle state, local artifact integrity, hardware/resource checks, settings, cache metadata, health scans, and recovery state. It prepares image, video, audio, voice, language, vision, embedding, and future model categories.

It intentionally does not download remote weights, generate media, render, export, authenticate, or call product APIs. An optional artifact path is copied into managed storage and validated with SHA-256; catalog-only installations are management profiles ready for a later execution provider.