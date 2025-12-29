"""
Offline translation service using Argos Translate.
"""
import threading
from typing import Optional, Dict, Tuple
from cachetools import TTLCache

import argostranslate.package
import argostranslate.translate

from .config import TranslationConfig


LANGUAGE_ICONS = {
    'en': '\U0001F1EC\U0001F1E7',  # GB flag
    'fr': '\U0001F1EB\U0001F1F7',  # FR flag
    'es': '\U0001F1EA\U0001F1F8',  # ES flag
    'de': '\U0001F1E9\U0001F1EA',  # DE flag
    'it': '\U0001F1EE\U0001F1F9',  # IT flag
    'pt': '\U0001F1F5\U0001F1F9',  # PT flag
    'ru': '\U0001F1F7\U0001F1FA',  # RU flag
    'zh': '\U0001F1E8\U0001F1F3',  # CN flag
    'ja': '\U0001F1EF\U0001F1F5',  # JP flag
    'ar': '\U0001F1F8\U0001F1E6',  # SA flag
    'default': '\U0001F310',  # Globe emoji
}


class TranslationService:
    """Offline translation service using Argos Translate with TTL caching"""

    def __init__(self, config: Optional[TranslationConfig] = None):
        self.config = config or TranslationConfig()
        self._cache = TTLCache(
            maxsize=self.config.cache_max_size,
            ttl=self.config.cache_ttl_seconds
        )
        self._lock = threading.RLock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }
        self._installed_packages: Dict[Tuple[str, str], bool] = {}
        self._initialized = False

    def _ensure_initialized(self):
        """Initialize Argos Translate on first use"""
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            # Update package index
            try:
                argostranslate.package.update_package_index()
                print("Argos Translate package index updated")
            except Exception as e:
                print(f"Warning: Could not update package index: {e}")

            self._initialized = True

    def _ensure_package_installed(self, source_lang: str, target_lang: str) -> bool:
        """Ensure the language pair package is installed"""
        pair_key = (source_lang, target_lang)

        # Check if already verified
        if pair_key in self._installed_packages:
            return self._installed_packages[pair_key]

        # Check if translation is available using get_translation_from_codes
        try:
            translation = argostranslate.translate.get_translation_from_codes(source_lang, target_lang)
            if translation:
                self._installed_packages[pair_key] = True
                return True
        except Exception:
            pass

        # Try to install the package
        try:
            available_packages = argostranslate.package.get_available_packages()
            package_to_install = next(
                (pkg for pkg in available_packages
                 if pkg.from_code == source_lang and pkg.to_code == target_lang),
                None
            )

            if package_to_install:
                print(f"Installing translation package: {source_lang} -> {target_lang}")
                argostranslate.package.install_from_path(package_to_install.download())
                self._installed_packages[pair_key] = True
                print(f"Package installed: {source_lang} -> {target_lang}")
                return True
            else:
                print(f"No package available for: {source_lang} -> {target_lang}")
                self._installed_packages[pair_key] = False
                return False

        except Exception as e:
            print(f"Failed to install package {source_lang} -> {target_lang}: {e}")
            self._installed_packages[pair_key] = False
            return False

    def get_language_icon(self, lang_code: Optional[str]) -> str:
        """Get flag emoji for language"""
        if not lang_code:
            return '\U0001F310'  # Globe emoji
        return LANGUAGE_ICONS.get(lang_code, '\U0001F310')

    def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> str:
        """
        Translate text offline using Argos Translate.

        Args:
            text: Text to translate
            source_lang: Source language code
            target_lang: Target language code

        Returns:
            Translated text, or original text if translation fails
        """
        # Don't translate if source and target are the same
        if source_lang == target_lang:
            return text

        if not text or not text.strip():
            return text

        # Ensure initialized
        self._ensure_initialized()

        cache_key = f"{source_lang}:{target_lang}:{text}"

        # Check cache with lock
        with self._lock:
            if cache_key in self._cache:
                self._stats['hits'] += 1
                return self._cache[cache_key]

        # Ensure package is installed
        if not self._ensure_package_installed(source_lang, target_lang):
            with self._lock:
                self._stats['errors'] += 1
            return text  # Return original if package not available

        # Translate outside lock to avoid blocking
        try:
            translated = argostranslate.translate.translate(text, source_lang, target_lang)

            # Cache result with lock
            with self._lock:
                self._cache[cache_key] = translated
                self._stats['misses'] += 1

            return translated

        except Exception as e:
            with self._lock:
                self._stats['errors'] += 1
            print(f"Translation error: {e}")
            return text  # Return original text if translation fails

    def get_installed_languages(self) -> list:
        """Get list of installed language codes"""
        self._ensure_initialized()
        try:
            languages = argostranslate.translate.get_installed_languages()
            return [lang.code for lang in languages if hasattr(lang, 'code')]
        except Exception:
            return []

    def get_available_pairs(self) -> list:
        """Get list of available translation pairs"""
        self._ensure_initialized()
        try:
            available_packages = argostranslate.package.get_available_packages()
            return [(pkg.from_code, pkg.to_code) for pkg in available_packages]
        except Exception:
            return []

    def get_stats(self) -> dict:
        """Get cache statistics"""
        with self._lock:
            return {
                **self._stats,
                'cache_size': len(self._cache),
                'hit_rate': (
                    self._stats['hits'] / (self._stats['hits'] + self._stats['misses'])
                    if (self._stats['hits'] + self._stats['misses']) > 0
                    else 0.0
                )
            }

    def clear_cache(self):
        """Clear the translation cache"""
        with self._lock:
            self._cache.clear()


# Global service instance (lazy initialized)
_service: Optional[TranslationService] = None
_service_lock = threading.Lock()


def get_translation_service(config: Optional[TranslationConfig] = None) -> TranslationService:
    """Get or create the global translation service"""
    global _service
    with _service_lock:
        if _service is None:
            _service = TranslationService(config)
        return _service
