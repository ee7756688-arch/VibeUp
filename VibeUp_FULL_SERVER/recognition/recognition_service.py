import asyncio
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from shazamio import Serialize, Shazam, SearchParams

app = FastAPI(title='VibeUp Recognition Service')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

MAX_BYTES = 10 * 1024 * 1024


def normalize_result(data):
    if not data:
        return None
    try:
        full = Serialize.full_track(data)
        track = full.track
        return {
            'title': getattr(track, 'title', None),
            'artist': getattr(track, 'artist', None),
            'album': getattr(track, 'album', None),
            'coverart': getattr(track, 'coverart', None),
            'coverart_350': getattr(track, 'coverart_350', None),
            'song_link': getattr(track, 'shazam_url', None) or getattr(track, 'share_url', None),
            'spotify_link': getattr(track, 'spotify_url', None),
            'youtube_link': getattr(track, 'youtube_link', None),
        }
    except Exception:
        # Keep the service resilient to serializer changes between ShazamIO versions.
        track = data.get('track') if isinstance(data, dict) else None
        if not isinstance(track, dict):
            return None
        return {
            'title': track.get('title'),
            'artist': track.get('subtitle'),
            'album': None,
            'coverart': (track.get('images') or {}).get('coverart'),
            'coverart_350': (track.get('images') or {}).get('coverarthq'),
            'song_link': (track.get('share') or {}).get('href'),
            'spotify_link': None,
            'youtube_link': None,
        }


@app.get('/health')
async def health():
    return {'ok': True, 'service': 'shazamio'}


@app.post('/recognize')
async def recognize(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, 'Аудиофрагмент пустой')
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Аудиофрагмент слишком большой')

    # ShazamIO accepts raw bytes and its current Rust fingerprint engine can decode
    # common containers (including WebM/Opus) before generating the signature.
    try:
        shazam = Shazam(segment_duration_seconds=10)
        try:
            raw = await shazam.recognize(
                data,
                options=SearchParams(segment_duration_seconds=10)
            )
        finally:
            close = getattr(shazam, "close", None)
            if close is not None:
                await close()

        result = normalize_result(raw)
    except Exception as exc:
        raise HTTPException(502, f'Ошибка ShazamIO: {exc}') from exc

    if not result or not result.get('title'):
        return {'result': None}
    return {'result': result}
