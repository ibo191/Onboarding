# Autoškola BuBu web + onboarding

Interaktívny prototyp novej webovej stránky Autoškoly BuBu s verejnou predajnou časťou, objednávkou kurzov, e-shopom, blogom, admin panelom a napojeným onboardingom študenta.

## Čo je hotové

- domovská stránka optimalizovaná na konverziu a SEO,
- reálne sekcie podľa aktuálneho webu: kurzy, pobočky Praha 8/Střížkov, Kladno, Statenice, ceník, blog a kontakt,
- produktové landing pages kurzov B, Ba, moto a B+E/B96,
- výber termínu kurzu a objednávkový formulár,
- po objednávke sa zníži počet voľných miest a vytvorí onboarding ticket,
- admin panel na objednávky, termíny kurzov, texty produktových stránok, blog, e-shop a analytiku,
- e-shop sekcia s merchom a admin pridávaním produktov,
- študentský onboarding s časovou osou, údajmi, dokumentmi, platbou a údajmi do systému Moje autoškola,
- pripomienky cez popup, potvrdenie vyriešenia a XML export iba schválených prihlášok.

## Brand

Použité pravidlá z logomanuálu:

- primárna tyrkysová `rgb(74, 185, 171)`,
- primárna modrá `rgb(47, 90, 166)`,
- biela, čierna,
- písmo Montserrat.

## Spustenie

```bash
python3 -m http.server 4173
```

Potom otvorte `http://127.0.0.1:4173/`.

## Poznámka

Prototyp je bez backendu a databázy. Dáta sa ukladajú do `localStorage`, takže je vhodný na UX, obsah a procesné ladenie. Produkčná verzia bude potrebovať databázu, autentifikáciu, platobnú bránu, e-mailové odosielanie, bezpečné úložisko dokumentov a presné napojenie na Moje autoškola.
