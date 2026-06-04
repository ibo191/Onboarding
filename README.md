# Autoškola BuBu web + onboarding

Interaktívny prototyp novej webovej stránky Autoškoly BuBu s verejnou predajnou časťou, objednávkou kurzov, e-shopom, blogom, admin panelom a napojeným onboardingom študenta.

## Čo je hotové

- domovská stránka optimalizovaná na konverziu a SEO,
- reálne sekcie podľa aktuálneho webu: kurzy, pobočky Praha 8/Střížkov, Kladno, Statenice, ceník, blog a kontakt,
- produktové landing pages kurzov B, Ba, moto a B+E/B96,
- objednávkový formulár kurzov,
- po objednávke sa zníži počet voľných miest a vytvorí onboarding ticket,
- admin panel na objednávky, termíny kurzov, texty produktových stránok, blog, e-shop a analytiku,
- e-shop sekcia s merchom a admin pridávaním produktov,
- študentský onboarding s časovou osou, údajmi, dokumentmi, platbou a údajmi do systému Moje autoškola,
- pripomienky cez popup, potvrdenie vyriešenia, tlač prihlášky a náhľady dokumentov.

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

## Supabase

Projekt je pripravený na postupné napojenie databázy Supabase bez zmeny stacku a bez npm balíkov. Statický web používa REST API klienta v `supabase-client.js` a konfiguračný endpoint `api/supabase-config.js`.

### Nastavenie

1. V Supabase vytvorte projekt.
2. V Supabase SQL editore spustite obsah súboru `supabase/schema.sql`.
3. Vo Verceli nastavte environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Spustite redeploy vo Verceli.

Po nastavení sa objednávky z webu, študentský portál a admin portál ukladajú do tabuľky `applications`. Ak env premenné nie sú nastavené, web ďalej funguje lokálne cez `localStorage`, aby sa prototyp nezastavil.

### Produkčný ďalší krok

Aktuálna schéma používa jednoduché RLS pravidlá vhodné na testovanie prototypu. Pred ostrou prevádzkou treba doplniť Supabase Auth, role pre admina/študenta, Storage bucket pre dokumenty a prísnejšie RLS politiky podľa prihláseného používateľa.

## Poznámka

Toto je postupný prechod z prototypu na produkčný systém. Databázové jadro je pripravené, ale ostrá verzia bude ešte potrebovať autentifikáciu, e-mailové odosielanie magic linkov, bezpečné úložisko dokumentov, platobnú bránu a presné napojenie na Moje autoškola.
