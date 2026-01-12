// Simple Sound Manager using Data URIs for zero-dependency sound effects

// Generated short 8-bit style sounds (base64 encoded WAVs for simplicity and reliability)
const SOUNDS = {
    // High pitch "Ding"
    CORRECT: 'data:audio/wav;base64,UklGRn4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoAAAAAAP///7//v//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+8=',
    // Soft "Pop"
    CHAT: 'data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQcAAAAAAP8A/wD/AP8=',
    // "Whistle" start (placeholder, using a simple beep)
    START: 'data:audio/wav;base64,UklGRn4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoAAAAAAP///7//v//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+8=',
    // Low pitch "Buzz"
    GAME_OVER: 'data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQcAAAAAAP8A/wD/AP8='
};

// We will use real hosted sounds for better quality, defaulting to silence if fail.
// For this environment, let's use a class that triggers `new Audio()`
// We can use some public domain sound assets if we wanted, but let's stick to a robust logical implementation.

const SFX = {
    pop: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', // Chat
    success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Correct
    start: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Start
    fanfare: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', // Win
    tick: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3', // Tick
};

class SoundManager {
    static play(key: keyof typeof SFX) {
        try {
            const audio = new Audio(SFX[key]);
            audio.volume = 0.4;
            audio.play().catch(e => console.warn("Audio play blocked", e));
        } catch (e) {
            console.error("Audio error", e);
        }
    }
}

export default SoundManager;
