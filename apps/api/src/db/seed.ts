import type { Client } from "@libsql/client";
import * as cardsRepo from "../repositories/cards.js";
import * as decksRepo from "../repositories/decks.js";

interface SeedCard {
  frontMd: string;
  backMd: string;
}

interface SeedDeck {
  name: string;
  description: string;
  isPublic?: boolean;
  cards: SeedCard[];
}

const SEED_DECKS: SeedDeck[] = [
  {
    name: "Spanish Vocabulary Basics",
    description: "Everyday greetings and common words to get started with Spanish.",
    isPublic: true,
    cards: [
      { frontMd: "Hello", backMd: "**Hola**" },
      { frontMd: "Goodbye", backMd: "**Adiós**" },
      { frontMd: "Please", backMd: "**Por favor**" },
      { frontMd: "Thank you", backMd: "**Gracias**" },
      { frontMd: "Yes / No", backMd: "**Sí** / **No**" },
      { frontMd: "Good morning", backMd: "**Buenos días**" },
      { frontMd: "Good night", backMd: "**Buenas noches**" },
      { frontMd: "How are you?", backMd: "**¿Cómo estás?**" },
      { frontMd: "My name is...", backMd: "**Me llamo...**" },
      { frontMd: "Water", backMd: "**Agua**" },
      { frontMd: "Friend", backMd: "**Amigo** (m) / **Amiga** (f)" },
      { frontMd: "House", backMd: "**Casa**" },
      { frontMd: "Dog", backMd: "**Perro**" },
      { frontMd: "Cat", backMd: "**Gato**" },
      { frontMd: "One, two, three", backMd: "**Uno, dos, tres**" },
      { frontMd: "I love you", backMd: "**Te quiero**" },
      { frontMd: "Excuse me / Sorry", backMd: "**Perdón**" },
      { frontMd: "Where is the bathroom?", backMd: "**¿Dónde está el baño?**" },
    ],
  },
  {
    name: "World Capitals",
    description: "Country → capital city, for two dozen countries around the world.",
    isPublic: true,
    cards: [
      { frontMd: "France", backMd: "Paris" },
      { frontMd: "Japan", backMd: "Tokyo" },
      { frontMd: "Australia", backMd: "Canberra" },
      { frontMd: "Canada", backMd: "Ottawa" },
      { frontMd: "Brazil", backMd: "Brasília" },
      { frontMd: "Egypt", backMd: "Cairo" },
      { frontMd: "Germany", backMd: "Berlin" },
      { frontMd: "Italy", backMd: "Rome" },
      { frontMd: "Russia", backMd: "Moscow" },
      { frontMd: "India", backMd: "New Delhi" },
      { frontMd: "China", backMd: "Beijing" },
      { frontMd: "South Africa", backMd: "Pretoria (administrative capital)" },
      { frontMd: "Mexico", backMd: "Mexico City" },
      { frontMd: "Spain", backMd: "Madrid" },
      { frontMd: "United Kingdom", backMd: "London" },
      { frontMd: "Turkey", backMd: "Ankara" },
      { frontMd: "Argentina", backMd: "Buenos Aires" },
      { frontMd: "South Korea", backMd: "Seoul" },
      { frontMd: "Kenya", backMd: "Nairobi" },
      { frontMd: "Norway", backMd: "Oslo" },
    ],
  },
  {
    name: "JavaScript Fundamentals",
    description: "Core language concepts every JS developer should have cold.",
    cards: [
      {
        frontMd: "What's the difference between `===` and `==`?",
        backMd:
          "`===` checks value **and** type with no coercion; `==` coerces operands first.\n\n```js\n0 == '0'   // true  (coerced)\n0 === '0'  // false (different types)\n```",
      },
      {
        frontMd: "What is a closure?",
        backMd:
          "A function that retains access to variables from its enclosing scope even after that scope has returned.\n\n```js\nfunction counter() {\n  let n = 0;\n  return () => ++n;\n}\nconst next = counter();\nnext(); // 1\nnext(); // 2\n```",
      },
      {
        frontMd: "`let` vs `const` vs `var` — what's the difference?",
        backMd:
          "- `var`: function-scoped, hoisted, re-assignable\n- `let`: block-scoped, re-assignable\n- `const`: block-scoped, cannot be re-assigned (but object/array contents can still mutate)",
      },
      {
        frontMd: "What does `Array.prototype.map` do?",
        backMd:
          "Returns a **new** array built by applying a function to every element — never mutates the original.\n\n```js\n[1, 2, 3].map((n) => n * 2); // [2, 4, 6]\n```",
      },
      {
        frontMd: "`null` vs `undefined` — what's the difference?",
        backMd:
          '`undefined` means a variable has been declared but not assigned a value. `null` is an explicit, intentional "no value" assigned by code.',
      },
      {
        frontMd: "What is destructuring assignment?",
        backMd:
          "Unpacking values from arrays/objects into distinct variables.\n\n```js\nconst { name, age } = user;\nconst [first, second] = list;\n```",
      },
      {
        frontMd: "What does the spread operator `...` do?",
        backMd:
          "Expands an iterable (array, string, object) into individual elements.\n\n```js\nconst combined = [...a, ...b];\nconst clone = { ...original };\n```",
      },
      {
        frontMd: "What is a Promise?",
        backMd:
          "An object representing the eventual result of an asynchronous operation, in one of three states: **pending**, **fulfilled**, or **rejected**.",
      },
      {
        frontMd: "What does `async`/`await` do?",
        backMd:
          "Syntax sugar over Promises that lets asynchronous code read like synchronous code.\n\n```js\nasync function load() {\n  const res = await fetch(url);\n  return res.json();\n}\n```",
      },
      {
        frontMd: "How does `this` behave differently in an arrow function?",
        backMd:
          "Arrow functions don't have their own `this` — they inherit it lexically from the enclosing scope, unlike regular functions where `this` depends on how the function is called.",
      },
      {
        frontMd: "What is event bubbling?",
        backMd:
          "When an event fires on an element, it propagates ('bubbles') upward through its ancestors in the DOM, triggering their handlers too, unless stopped with `stopPropagation()`.",
      },
      {
        frontMd: "`forEach` vs `map` — what's the difference?",
        backMd:
          "`forEach` runs a function per element and returns `undefined` — used for side effects. `map` returns a new array of transformed values.",
      },
      {
        frontMd: "What is a template literal?",
        backMd:
          // biome-ignore lint/suspicious/noTemplateCurlyInString: card text demonstrating the syntax, not real interpolation.
          "A string wrapped in backticks that supports interpolation and multi-line text.\n\n```js\nconst greeting = `Hello, ${name}!`;\n```",
      },
      {
        frontMd: "What does `Array.prototype.reduce` do?",
        backMd:
          "Folds an array down to a single accumulated value.\n\n```js\n[1, 2, 3].reduce((sum, n) => sum + n, 0); // 6\n```",
      },
      {
        frontMd: "Synchronous vs. asynchronous code — what's the difference?",
        backMd:
          "Synchronous code runs top-to-bottom, blocking until each step finishes. Asynchronous code lets long-running work (network, timers) happen in the background via the event loop, without blocking execution.",
      },
    ],
  },
  {
    name: "Periodic Table Elements",
    description: "Symbol → name, atomic number, and category for common elements.",
    isPublic: true,
    cards: [
      { frontMd: "H", backMd: "**Hydrogen** — atomic number 1 — Nonmetal" },
      { frontMd: "He", backMd: "**Helium** — atomic number 2 — Noble gas" },
      { frontMd: "Li", backMd: "**Lithium** — atomic number 3 — Alkali metal" },
      { frontMd: "C", backMd: "**Carbon** — atomic number 6 — Nonmetal" },
      { frontMd: "N", backMd: "**Nitrogen** — atomic number 7 — Nonmetal" },
      { frontMd: "O", backMd: "**Oxygen** — atomic number 8 — Nonmetal" },
      { frontMd: "Na", backMd: "**Sodium** — atomic number 11 — Alkali metal" },
      { frontMd: "Mg", backMd: "**Magnesium** — atomic number 12 — Alkaline earth metal" },
      { frontMd: "Al", backMd: "**Aluminum** — atomic number 13 — Post-transition metal" },
      { frontMd: "Si", backMd: "**Silicon** — atomic number 14 — Metalloid" },
      { frontMd: "Cl", backMd: "**Chlorine** — atomic number 17 — Halogen" },
      { frontMd: "K", backMd: "**Potassium** — atomic number 19 — Alkali metal" },
      { frontMd: "Ca", backMd: "**Calcium** — atomic number 20 — Alkaline earth metal" },
      { frontMd: "Fe", backMd: "**Iron** — atomic number 26 — Transition metal" },
      { frontMd: "Cu", backMd: "**Copper** — atomic number 29 — Transition metal" },
      { frontMd: "Zn", backMd: "**Zinc** — atomic number 30 — Transition metal" },
      { frontMd: "Ag", backMd: "**Silver** — atomic number 47 — Transition metal" },
      { frontMd: "Au", backMd: "**Gold** — atomic number 79 — Transition metal" },
      { frontMd: "Pb", backMd: "**Lead** — atomic number 82 — Post-transition metal" },
    ],
  },
  {
    name: "Music Theory Basics",
    description: "Scales, intervals, chords, and rhythm fundamentals.",
    cards: [
      {
        frontMd: "What's the interval pattern of a major scale?",
        backMd: "Whole–Whole–Half–Whole–Whole–Whole–Half (e.g. C D E F G A B C)",
      },
      {
        frontMd: "What's the interval pattern of a natural minor scale?",
        backMd: "Whole–Half–Whole–Whole–Half–Whole–Whole (e.g. A B C D E F G A)",
      },
      {
        frontMd: "What is a musical interval?",
        backMd: "The distance in pitch between two notes, e.g. a major third or perfect fifth.",
      },
      {
        frontMd: "What is a perfect fifth?",
        backMd: "An interval spanning 7 semitones — e.g. C up to G.",
      },
      {
        frontMd: "What is a triad?",
        backMd: "A three-note chord built from a root, a third, and a fifth.",
      },
      {
        frontMd: "What notes make up a major chord?",
        backMd: "Root, major third, perfect fifth (e.g. C major = C–E–G).",
      },
      {
        frontMd: "What notes make up a minor chord?",
        backMd: "Root, minor third, perfect fifth (e.g. C minor = C–E♭–G).",
      },
      {
        frontMd: 'What does "tempo" mean?',
        backMd: "The speed of the music, usually measured in beats per minute (BPM).",
      },
      {
        frontMd: "What is a time signature?",
        backMd:
          "A notation (e.g. 4/4) that tells you how many beats are in each measure and which note value counts as one beat.",
      },
      {
        frontMd: "What does a 4/4 time signature mean?",
        backMd: "Four beats per measure, with the quarter note getting one beat.",
      },
      {
        frontMd: "What is a key signature?",
        backMd: "The sharps or flats shown at the start of a staff, indicating the scale/key the piece is in.",
      },
      {
        frontMd: "What is the circle of fifths?",
        backMd: "A diagram arranging the 12 keys in order of perfect fifths, showing how closely related they are.",
      },
      {
        frontMd: "What is syncopation?",
        backMd: "Emphasizing a normally weak beat or off-beat, creating rhythmic surprise.",
      },
      {
        frontMd: "What is a cadence?",
        backMd:
          "A chord progression that ends a musical phrase, giving a sense of resolution (or intentional non-resolution).",
      },
      {
        frontMd: "Staccato vs. legato — what's the difference?",
        backMd: "**Staccato** notes are played short and detached; **legato** notes are played smooth and connected.",
      },
    ],
  },
];

/**
 * Seeds the 5 sample decks for one account, if it has none yet.
 *
 * Only seeds a user who has no decks yet: never touches an account that already has some, so
 * re-running this (or restarting a container with a persisted volume) can't duplicate content.
 * Per-user now that decks are owned (there's no more "the whole DB is empty" global case).
 */
export async function seedIfEmpty(db: Client, userId: string): Promise<void> {
  const existingDecks = await decksRepo.listDecks(db, userId);
  if (existingDecks.length > 0) return;

  for (const deck of SEED_DECKS) {
    const created = await decksRepo.createDeck(db, userId, {
      name: deck.name,
      description: deck.description,
    });
    for (const card of deck.cards) {
      await cardsRepo.createCard(db, {
        deckId: created.id,
        frontMd: card.frontMd,
        backMd: card.backMd,
      });
    }
    // A few seed decks default to public so Community isn't empty the first time someone runs
    // seed:samples against a fresh account.
    if (deck.isPublic) {
      await decksRepo.setPublic(db, created.id, userId, true);
    }
  }
}
