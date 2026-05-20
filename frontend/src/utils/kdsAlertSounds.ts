export type KdsAlertSound =
    | 'service_bell'
    | 'double_chime'
    | 'soft_ping'
    | 'urgent_pulse'
    | 'loud_bell'
    | 'loud_double_bell'
    | 'triple_chime'
    | 'kitchen_siren'
    | 'alarm_burst'
    | 'double_alarm'
    | 'long_ring'
    | 'new_order_grab_2022'
    | 'dragon_studio_festive_chime_439612'
    | 'got_retro_synth_alert_438279'
    | 'universfield_ringtone_058_495412'
    | 'universfield_ringtone_069_496274'
    | 'notification_alert_3_331723'
    | 'notification_alert_4_331722'
    | 'universfield_ringtone_072_496297'
    | 'universfield_new_notification_022_370046'
    | 'dragon_studio_alert_444816'
    | 'mixkit_bless_choir_655'
    | 'mixkit_choir_bell_bless_656'
    | 'mixkit_futuristic_doorbell_928'
    | 'mixkit_bells_of_summer_929'
    | 'mixkit_bell_of_promise_930'
    | 'mixkit_correct_positive_answer_949'
    | 'mixkit_intro_transition_1146'
    | 'mixkit_game_show_suspense_waiting_667'
    | 'mixkit_successful_horns_fanfare_722'
    | 'mixkit_clown_horn_at_circus_715'
    | 'mixkit_melodic_gold_price_2000'
    | 'mixkit_magical_coin_win_1936'
    | 'mixkit_christmas_magic_bell_hit_939'
    | 'mixkit_modern_classic_door_bell_113'
    | 'mixkit_home_standard_ding_dong_109'
    | 'mixkit_notification_bell_592'
    | 'mixkit_uplifting_bells_notification_938'
    | 'mixkit_cartoon_door_melodic_bell_110'
    | 'mixkit_achievement_bell_600'
    | 'mixkit_happy_bells_notification_937'
    | 'off';

const BUILTIN_KDS_ALERT_SOUND_OPTIONS: Array<{ value: KdsAlertSound; label: string }> = [
    { value: 'service_bell', label: 'Service Bell' },
    { value: 'double_chime', label: 'Double Chime' },
    { value: 'soft_ping', label: 'Soft Ping' },
    { value: 'urgent_pulse', label: 'Urgent Pulse' },
    { value: 'loud_bell', label: 'Loud Bell' },
    { value: 'loud_double_bell', label: 'Loud Double Bell' },
    { value: 'triple_chime', label: 'Triple Chime' },
    { value: 'kitchen_siren', label: 'Kitchen Siren' },
    { value: 'alarm_burst', label: 'Alarm Burst' },
    { value: 'double_alarm', label: 'Double Alarm' },
    { value: 'long_ring', label: 'Long Ring' },
    { value: 'off', label: 'Off' },
];

const FILE_KDS_ALERT_SOUND_OPTIONS: Array<{ value: KdsAlertSound; label: string; url: string }> = [
    { value: 'new_order_grab_2022', label: 'New Order Grab 2022', url: '/kds-alerts/new-order-grab-2022.mp3' },
    { value: 'dragon_studio_festive_chime_439612', label: 'Dragon Studio Festive Chime', url: '/kds-alerts/dragon-studio-festive-chime-439612.mp3' },
    { value: 'got_retro_synth_alert_438279', label: 'Retro Synth Alert', url: '/kds-alerts/diogodasilvasimoes-game-of-thrones-notification-retro-synth-alert-sound-438279.mp3' },
    { value: 'universfield_ringtone_058_495412', label: 'Universfield Ringtone 058', url: '/kds-alerts/universfield-ringtone-058-495412.mp3' },
    { value: 'universfield_ringtone_069_496274', label: 'Universfield Ringtone 069', url: '/kds-alerts/universfield-ringtone-069-496274.mp3' },
    { value: 'notification_alert_3_331723', label: 'Notification Alert 3', url: '/kds-alerts/notification-message-notification-alert-3-331723.mp3' },
    { value: 'notification_alert_4_331722', label: 'Notification Alert 4', url: '/kds-alerts/notification-message-notification-alert-4-331722.mp3' },
    { value: 'universfield_ringtone_072_496297', label: 'Universfield Ringtone 072', url: '/kds-alerts/universfield-ringtone-072-496297.mp3' },
    { value: 'universfield_new_notification_022_370046', label: 'Universfield New Notification 022', url: '/kds-alerts/universfield-new-notification-022-370046.mp3' },
    { value: 'dragon_studio_alert_444816', label: 'KOS - Alert 002', url: '/kds-alerts/dragon-studio-alert-444816.mp3' },
    { value: 'mixkit_bless_choir_655', label: 'Bless Choir', url: '/kds-alerts/mixkit-bless-choir-655.wav' },
    { value: 'mixkit_choir_bell_bless_656', label: 'Choir Bell Bless', url: '/kds-alerts/mixkit-choir-bell-bless-656.wav' },
    { value: 'mixkit_futuristic_doorbell_928', label: 'Futuristic Doorbell', url: '/kds-alerts/mixkit-futuristic-doorbell-928.wav' },
    { value: 'mixkit_bells_of_summer_929', label: 'Bells Of Summer', url: '/kds-alerts/mixkit-bells-of-summer-929.wav' },
    { value: 'mixkit_bell_of_promise_930', label: 'Bell Of Promise', url: '/kds-alerts/mixkit-bell-of-promise-930.wav' },
    { value: 'mixkit_correct_positive_answer_949', label: 'Correct Positive Answer', url: '/kds-alerts/mixkit-correct-positive-answer-949.wav' },
    { value: 'mixkit_intro_transition_1146', label: 'Intro Transition', url: '/kds-alerts/mixkit-intro-transition-1146.wav' },
    { value: 'mixkit_game_show_suspense_waiting_667', label: 'Game Show Suspense Waiting', url: '/kds-alerts/mixkit-game-show-suspense-waiting-667.wav' },
    { value: 'mixkit_successful_horns_fanfare_722', label: 'Successful Horns Fanfare', url: '/kds-alerts/mixkit-successful-horns-fanfare-722.wav' },
    { value: 'mixkit_clown_horn_at_circus_715', label: 'Clown Horn At Circus', url: '/kds-alerts/mixkit-clown-horn-at-circus-715.wav' },
    { value: 'mixkit_melodic_gold_price_2000', label: 'Melodic Gold Price', url: '/kds-alerts/mixkit-melodic-gold-price-2000.wav' },
    { value: 'mixkit_magical_coin_win_1936', label: 'Magical Coin Win', url: '/kds-alerts/mixkit-magical-coin-win-1936.wav' },
    { value: 'mixkit_christmas_magic_bell_hit_939', label: 'KOS - Alert 001', url: '/kds-alerts/mixkit-christmas-magic-bell-hit-939.wav' },
    { value: 'mixkit_modern_classic_door_bell_113', label: 'Modern Classic Door Bell', url: '/kds-alerts/mixkit-modern-classic-door-bell-sound-113.wav' },
    { value: 'mixkit_home_standard_ding_dong_109', label: 'Home Standard Ding Dong', url: '/kds-alerts/mixkit-home-standard-ding-dong-109.wav' },
    { value: 'mixkit_notification_bell_592', label: 'Notification Bell', url: '/kds-alerts/mixkit-notification-bell-592.wav' },
    { value: 'mixkit_uplifting_bells_notification_938', label: 'Uplifting Bells Notification', url: '/kds-alerts/mixkit-uplifting-bells-notification-938.wav' },
    { value: 'mixkit_cartoon_door_melodic_bell_110', label: 'Cartoon Door Melodic Bell', url: '/kds-alerts/mixkit-cartoon-door-melodic-bell-110.wav' },
    { value: 'mixkit_achievement_bell_600', label: 'Achievement Bell', url: '/kds-alerts/mixkit-achievement-bell-600.wav' },
    { value: 'mixkit_happy_bells_notification_937', label: 'Happy Bells Notification', url: '/kds-alerts/mixkit-happy-bells-notification-937.wav' },
];

export const KDS_ALERT_SOUND_OPTIONS: Array<{ value: KdsAlertSound; label: string }> = [
    ...BUILTIN_KDS_ALERT_SOUND_OPTIONS,
    ...FILE_KDS_ALERT_SOUND_OPTIONS.map(({ value, label }) => ({ value, label })),
].sort((left, right) => left.label.localeCompare(right.label));

export const getKdsAlertSoundLabel = (sound: KdsAlertSound | string | null | undefined) =>
    KDS_ALERT_SOUND_OPTIONS.find((option) => option.value === sound)?.label || 'Off';

let sharedAudioContext: AudioContext | null = null;
let activeAudioElement: HTMLAudioElement | null = null;
const decodedFileSoundCache = new Map<string, Promise<AudioBuffer | null>>();

const getAudioContext = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    const ContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextCtor) {
        return null;
    }
    if (!sharedAudioContext) {
        sharedAudioContext = new ContextCtor();
    }
    return sharedAudioContext;
};

const scheduleTone = (ctx: AudioContext, startTime: number, frequency: number, duration: number, gainValue: number) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
};

export const primeKdsAudio = async () => {
    const ctx = getAudioContext();
    if (!ctx) {
        return false;
    }
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch {
            return false;
        }
    }
    return true;
};

const loadFileSoundBuffer = async (url: string) => {
    const ctx = getAudioContext();
    if (!ctx || typeof window === 'undefined') {
        return null;
    }

    if (!decodedFileSoundCache.has(url)) {
        decodedFileSoundCache.set(url, (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    return null;
                }
                const arrayBuffer = await response.arrayBuffer();
                return await ctx.decodeAudioData(arrayBuffer.slice(0));
            } catch {
                return null;
            }
        })());
    }

    return decodedFileSoundCache.get(url) ?? null;
};

const resolveGain = (baseGain: number, volumeLevel: number) => {
    const normalized = Math.min(Math.max(volumeLevel, 0), 100) / 100;
    return Math.min(baseGain * normalized, 0.45);
};

export const playKdsAlert = async (sound: KdsAlertSound, volumeLevel = 85): Promise<boolean> => {
    if (sound === 'off') {
        return true;
    }
    const fileSound = FILE_KDS_ALERT_SOUND_OPTIONS.find((option) => option.value === sound);
    if (fileSound) {
        const isReady = await primeKdsAudio();
        const ctx = getAudioContext();
        if (isReady && ctx) {
            const buffer = await loadFileSoundBuffer(fileSound.url);
            if (buffer) {
                const source = ctx.createBufferSource();
                const gain = ctx.createGain();
                source.buffer = buffer;
                gain.gain.value = Math.min(Math.max(volumeLevel, 0), 100) / 100;
                source.connect(gain);
                gain.connect(ctx.destination);
                source.start();
                return true;
            }
        }

        if (activeAudioElement) {
            activeAudioElement.pause();
            activeAudioElement.currentTime = 0;
        }
        const audio = new Audio(fileSound.url);
        activeAudioElement = audio;
        audio.volume = Math.min(Math.max(volumeLevel, 0), 100) / 100;
        try {
            await audio.play();
            return true;
        } catch {
            return false;
        }
    }
    const isReady = await primeKdsAudio();
    if (!isReady) {
        return false;
    }
    const ctx = getAudioContext();
    if (!ctx) {
        return false;
    }

    const start = ctx.currentTime + 0.02;
    switch (sound) {
        case 'service_bell':
            scheduleTone(ctx, start, 1046, 0.22, resolveGain(0.22, volumeLevel));
            scheduleTone(ctx, start + 0.14, 1568, 0.72, resolveGain(0.18, volumeLevel));
            break;
        case 'double_chime':
            scheduleTone(ctx, start, 880, 0.22, resolveGain(0.17, volumeLevel));
            scheduleTone(ctx, start + 0.28, 1174, 0.34, resolveGain(0.17, volumeLevel));
            break;
        case 'soft_ping':
            scheduleTone(ctx, start, 1318, 0.24, resolveGain(0.12, volumeLevel));
            break;
        case 'urgent_pulse':
            scheduleTone(ctx, start, 740, 0.18, resolveGain(0.18, volumeLevel));
            scheduleTone(ctx, start + 0.22, 740, 0.18, resolveGain(0.18, volumeLevel));
            scheduleTone(ctx, start + 0.46, 988, 0.34, resolveGain(0.2, volumeLevel));
            break;
        case 'loud_bell':
            scheduleTone(ctx, start, 988, 0.26, resolveGain(0.32, volumeLevel));
            scheduleTone(ctx, start + 0.12, 1480, 0.92, resolveGain(0.24, volumeLevel));
            break;
        case 'loud_double_bell':
            scheduleTone(ctx, start, 988, 0.24, resolveGain(0.3, volumeLevel));
            scheduleTone(ctx, start + 0.14, 1480, 0.56, resolveGain(0.22, volumeLevel));
            scheduleTone(ctx, start + 0.78, 988, 0.24, resolveGain(0.3, volumeLevel));
            scheduleTone(ctx, start + 0.92, 1480, 0.56, resolveGain(0.22, volumeLevel));
            break;
        case 'triple_chime':
            scheduleTone(ctx, start, 784, 0.22, resolveGain(0.2, volumeLevel));
            scheduleTone(ctx, start + 0.28, 988, 0.24, resolveGain(0.2, volumeLevel));
            scheduleTone(ctx, start + 0.58, 1318, 0.44, resolveGain(0.2, volumeLevel));
            break;
        case 'kitchen_siren':
            scheduleTone(ctx, start, 880, 0.24, resolveGain(0.26, volumeLevel));
            scheduleTone(ctx, start + 0.26, 1174, 0.24, resolveGain(0.26, volumeLevel));
            scheduleTone(ctx, start + 0.54, 880, 0.24, resolveGain(0.26, volumeLevel));
            scheduleTone(ctx, start + 0.82, 1174, 0.36, resolveGain(0.28, volumeLevel));
            break;
        case 'alarm_burst':
            scheduleTone(ctx, start, 932, 0.3, resolveGain(0.3, volumeLevel));
            scheduleTone(ctx, start + 0.18, 1244, 0.3, resolveGain(0.3, volumeLevel));
            scheduleTone(ctx, start + 0.36, 932, 0.3, resolveGain(0.3, volumeLevel));
            scheduleTone(ctx, start + 0.54, 1244, 0.48, resolveGain(0.32, volumeLevel));
            break;
        case 'double_alarm':
            scheduleTone(ctx, start, 880, 0.34, resolveGain(0.34, volumeLevel));
            scheduleTone(ctx, start + 0.38, 1320, 0.34, resolveGain(0.34, volumeLevel));
            scheduleTone(ctx, start + 1, 880, 0.34, resolveGain(0.34, volumeLevel));
            scheduleTone(ctx, start + 1.38, 1320, 0.5, resolveGain(0.34, volumeLevel));
            break;
        case 'long_ring':
            scheduleTone(ctx, start, 1046, 0.34, resolveGain(0.28, volumeLevel));
            scheduleTone(ctx, start + 0.1, 1568, 1.35, resolveGain(0.24, volumeLevel));
            break;
        default:
            break;
    }
    return true;
};

export const playPosCartAddSound = async () => {
    await playKdsAlert('soft_ping', 100);
};

export const playPosCartReduceSound = async () => {
    await playKdsAlert('soft_ping', 85);
};
