import { OneKMem, IOneKMem } from '../models/OneKMem';
import { EmbedBuilder } from 'discord.js';
import { logger } from './logger';

// Stage activation times (hardcoded)
const STAGE_ACTIVATION_TIMES = {
  1: new Date('2025-08-25T13:00:00.000Z'), // Monday 25th Aug 13:00 UTC 
  2: new Date('2025-08-26T13:00:00.000Z'), // Tuesday 26th Aug 13:00 UTC 
  3: new Date('2025-08-27T13:00:00.000Z'), // Wednesday 27th Aug 13:00 UTC 
  4: new Date('2025-08-28T13:00:00.000Z'), // Thursday 28th Aug 13:00 UTC 
  5: new Date('2025-08-29T13:00:00.000Z'), // Friday 29th Aug 13:00 UTC 
  6: new Date('2025-08-30T13:00:00.000Z'), // Saturday 30th Aug 13:00 UTC 
  7: new Date('2025-08-31T13:00:00.000Z'), // Sunday 31st Aug 13:00 UTC 
  8: new Date('2025-09-01T13:00:00.000Z'), // Monday 1st Sep 13:00 UTC 
  9: new Date('2025-09-02T13:00:00.000Z'), // Tuesday 2nd Sep 13:00 UTC 
  10: new Date('2025-09-03T13:00:00.000Z'), // Wednesday 3rd Sep 13:00 UTC 
};

// Stage descriptions
const STAGE_DESCRIPTIONS = {
  1: "The world shifts, and you find yourself idle. As you feel the weight in your feet, you drag one after the other. Your body aches. Mysthaven is silent. The System is stuttering. A mission appears—The System urges you onto a side quest: decipher the message and uncover the Sovereign’s treasure.\n\n*\"Hidden in the deep green of Mysthaven rests a key to locating the prize. The blue sky reflects on the rivers that flow through Moonveil, passing the whispers of the forest, lies a name that brings forth the clue.\"*",
  2: "You summon a portal after voicing the name the Sovereigns left behind. A world unfamiliar—a world that was once at peace, now ruled by the Demon Lord—unfolds beyond the hazy purple gates. Strange creatures appear, ones you first mistake for leaves carried by the wind's breeze. They dance and frolic in the overgrown grass. You ask what they are, but The System turns to static, leaving the word unknown.\n\nOne of them leaps forward, a childlike forest spirit with a mischievous grin, jumping and screeching in a high-pitched tone. This world feels so strange, and you can't help but laugh—wondering what, exactly, this creature could be.",
  3: "Korok! You remembered! The tiny creature approaches, handing you a device that looks even more futuristic than the arcane energy stones of Mysthaven. Without warning, the Korok shoves it onto your head and over your ears.\n\n*\"Erm… Korok… why do these have bunny ears?\"* you ask.\n\nThe Korok says nothing. It only stares—judging you silently. Its leafy face twists into an angry little scowl as you meet its gaze. Then, suddenly, you hear it: a rhythm softly flowing into your ears. It’s heavenly—so serene you can almost see yourself wandering through the Whispering Glade.\n\nYou turn to the Korok again. *“What is the name of this peaceful tune?”* you ask.\n\nThe Korok only squeals.\n\nYour hand curls into a fist. *“I must know the name of this song!”* you shout.",
  4: "As the final note of the song fades, the portal begins to collapse, the purple haze drawing shut like a curtain. The Korok squeals one last time before vanishing into the wind, leaving you utterly alone.\n\nYou tug at the strange headphones still wrapped around your ears—only to realize they remain, pulsing faintly with arcane energy.\n\nWhen you whisper the song’s name, the headphones tremble. A spark of light shoots forth, carving a single glowing code into the soil before you...\n\n🔴 🦅 🍎 🪜 🌙",
  5: "You suddenly teleport to a new realm?! Strange devices with wheels roll past you at dizzying speeds, leaving you bewildered by the view that unfolds. Determined to explore, you take a stroll through this bizarre world—one so vastly different from the lands you know.\n\nYou see taverns, farmer’s markets, gold stores… yet something feels wrong. Everything looks strange. *What is a McDonald’s?*\n\nAs you regain your composure, your steps slow before an esoteric shop, its window glimmering with items that feel oddly familiar. Suddenly, static crackles from the device the Korok forced upon your head. You push the door open, and the noise ceases. The sign above reads: **Trinity of 26 Stars**.\n\nA haunting tune begins to play. You glance at the wall and see a moving painting—its figures shifting in rhythm with the sound. Below it, a label reads: “The Wizard — Black Sabbath.”\n\nConfused, you whisper: *“What realm offers such torment so freely to its people?”*\n\nBut as the melody flows, something changes. The rhythm takes hold of you, and before long, you find yourself singing along. Then, one lyric strikes you—it feels as though it was written for you alone.",
  6: "You blink—and you’re back in Mysthaven. Even more confused than before, the memory of those strange taverns in the other realm lingers, leaving you parched. You stumble into the nearest tavern and collapse into a chair, letting the weight of the day slip away.\n\nHours pass in a haze. When you finally stagger out the door, dawn greets you with its golden glow. The sun is rising. You squint at the sky, muttering to yourself, *“What time is it?”*\n\nThe clouds drift lazily overhead… all but one. This one moves differently—faster, deliberate. Before you can react, it rushes toward you. A weapon is drawn—ready to strike—only for the cloud to screech to a halt and… honk?\n\n*“What on earth is going on?”* you whisper. At this point, nothing surprises you anymore. You shake your head, yearning for the comfort of a bed, and begin the slow trek back to Moonveil.\n\nBut fate has other plans. Your foot catches on a rock, and you crash forward. The ground feels soft—far too soft. *“Is this… heaven?”* you mumble.\n\nNo. You’re on the cloud.\n\nBefore you can process this, the cloud zooms off, carrying you higher and higher. Panic seizes you as the ground fades, the sun blazing ever closer. *“I can’t breathe!”* you cry out.\n\nThen you see it: an angelic figure ahead—faceless, featureless, a being of pure white light with wings that stretch across eternity.\n\n*“Don’t worry,”* it says. *“You are not dying. Welcome to the Realm of the Rulers. I am the Omnipotent.”*\n\nYour mind spins. Are you dreaming? Drunk? Both? Still, you listen as the Omnipotent speaks—its voice like rolling thunder and soft rain. It tells you of another realm called Earth, a place with wonders beyond imagining: strange things named *Valorant* and *The Smiths*, and above all… food. So much food.\n\nThe Omnipotent laughs heartily at your ignorance, teasing you for never tasting Earth’s legendary cuisine. Then, leaning close, it begins to tell a story—of a dish so exquisite, so divine, it humbled even a being like itself during a visit to that distant realm…",
  7: "The Omnipotent recalls the dish and forms a recipe from the taste it once remembered. It hands you the recipe for your enjoyment, and you begin to wonder how you even arrived at this point. You ask yourself, *“How does this relate to the quest?”* Determined to find out, you form a plan: you will create this dish for the Omnipotent and hope it answers your question.\n\nYou request a kitchen, and the Omnipotent kindly guides you to the chef’s area. You begin to craft this unfamiliar item, recalling a vague memory of seeing it through a “mcdoodles?” you murmur.\n\nOnce finished, you offer the dish to the Omnipotent. The fresh aroma of onion, meat, and toasted bread combined makes even your mouth water. The Omnipotent is visibly overjoyed by your consideration and grants you newfound strength for your quest.\n\nYou ask if it knows of the hidden treasure left in the Whispering Glade. The Omnipotent pauses, recalling that it was left by a sovereign. It explains that the sovereign has now fallen and resides deep within the forests of Mysthaven, holding all the information you need — but urges you to exercise caution should you visit.\n\nAs you prepare to hop onto the cloud, the Omnipotent offers a helpful hint about the sovereign’s name: *“The name is one word, though it carries two ideas within it: the untamed spirit and the heart of life itself. Speak it three times, and the dungeon will appear before you.”*",
  8: "Your body begins to fade slightly. Staring at the palm of your hands, they start to become more and more opaque until even your sight vanishes. A few seconds later, your body gathers its particles and restores itself—the only difference being your location; you now stand at the face of a dungeon.\n\nYou lightly step into the cave, lit only by fireflies. Moss and leaves grow from the walls, and a thick fog drifts from deeper within.\n\nSuddenly, you hear a rustling sound. An armored, tree-like body covered in a mane of leaves, with feathers sprouting from its back, emerges from the rubble. You instantly draw your weapon, preparing for a battle to the death with the fallen sovereign.\n\n*“I only wanted to talk,”* you exclaim, yet it pays no attention and launches thorns vigorously.\n\nFrom the feathers on its back, a potion slips and falls onto a pile of leaves. You are drawn to it, but are clueless as to what it is. Before you drink it, you must know the name of the potion. It is something you are certain you have seen and used before, but you cannot recall its name. As you hesitate, the sparkling white-and-blue potion pulses with a radiant, white aura.",
  9: "The Time Potion! You recall it, certain it is safe. You drink it, and in an instant, you find yourself back at the dungeon’s gate. This time, you take a different approach. At each step, you gently announce that you are here to speak with the Wildheart Sovereign and that you bring no harm.\n\nAs you reach the spot where you previously encountered the fallen deity, it awaits you—ready for discussion, yet still eerily cautious.\n\nYou ask the deity if it recalls the sovereign’s treasure. It responds,\n*“Thousands of years have passed since I rested that treasure in this world. The Omnipotent tampered with my memories once I betrayed the trust of my previous colleagues; not much memory remains of that time. I am certain the Omnipotent had laid a hidden code somewhere in Mysthaven, at a request I had made. Although I do not recall the details—it is still out there, ready to be found.”*",
  10: "A dark, mysterious portal opens before you. The device the Korok had given you is swallowed by the portal as if it were a black hole. The portal rumbles and shakes before it shoots out a scroll, which reads:\n\n*“All power and strength will be yielded by the one who speaks the final code — no hints, no more to the Sovereign's story.”*"
};

export async function checkAndActivateStages(): Promise<void> {
  try {
    const now = new Date();
    
    // Check each stage for activation
    for (const [stageNumber, activationTime] of Object.entries(STAGE_ACTIVATION_TIMES)) {
      const stage = parseInt(stageNumber);
      
      if (now >= activationTime) {
        await activateStage(stage);
      }
    }
  } catch (error) {
    logger.error('Error checking stage activation:', error);
  }
}

async function activateStage(stageNumber: number): Promise<void> {
  try {
    const stageKey = `stage${stageNumber}`;
    
    let usersToActivate;
    
    if (stageNumber === 1) {
      // For stage 1, find all users who haven't started stage 1 yet
      usersToActivate = await OneKMem.find({
        [`${stageKey}.startedAt`]: new Date(0), // Stage hasn't started yet
        [`${stageKey}.completedAt`]: new Date(0) // Stage hasn't been completed yet
      });
    } else {
      // For other stages, find users who have completed the previous stage but haven't started this stage yet
      usersToActivate = await OneKMem.find({
        [`${stageKey}.startedAt`]: new Date(0), // Stage hasn't started yet
        [`${stageKey}.completedAt`]: new Date(0), // Stage hasn't been completed yet
        completedStages: { $in: [stageNumber - 1] } // Previous stage is completed
      });
    }
    
    if (usersToActivate.length === 0) {
      logger.info(`No users to activate for stage ${stageNumber}`);
      return;
    }
    
    logger.info(`Activating stage ${stageNumber} for ${usersToActivate.length} users`);
    
    // Update all eligible users
    for (const user of usersToActivate) {
      try {
        // Set the stage as started
        (user as any)[stageKey].startedAt = new Date();
        
        // Mark that this user needs the stage embed sent
        if (!user.pendingStageEmbeds) user.pendingStageEmbeds = [];
        user.pendingStageEmbeds.push(stageNumber);
        
        await user.save();
        
        logger.info(`Activated stage ${stageNumber} for user ${user.userId}`);
      } catch (error) {
        logger.error(`Error activating stage ${stageNumber} for user ${user.userId}:`, error);
      }
    }
    
  } catch (error) {
    logger.error(`Error activating stage ${stageNumber}:`, error);
  }
}

export function getStageActivationTime(stageNumber: number): Date | null {
  return STAGE_ACTIVATION_TIMES[stageNumber as keyof typeof STAGE_ACTIVATION_TIMES] || null;
}

export function isStageActive(stageNumber: number): boolean {
  const activationTime = getStageActivationTime(stageNumber);
  if (!activationTime) return false;
  
  return new Date() >= activationTime;
}

export function getStageDescription(stageNumber: number): string | null {
  return STAGE_DESCRIPTIONS[stageNumber as keyof typeof STAGE_DESCRIPTIONS] || null;
}

export function getStageDifficulty(stageNumber: number): string {
  switch (stageNumber) {
    case 1: return "EASY";
    case 2: return "MEDIUM";
    case 3: return "MEDIUM";
    case 4: return "EASY";
    case 5: return "MEDIUM";
    case 6: return "MEDIUM";
    case 7: return "EASY";
    case 8: return "MEDIUM";
    case 9: return "HARD";
    case 10: return "EASY";
    default: return "UNKNOWN";
  }
}
