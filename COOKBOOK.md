# Build Your Own Font Search Engine

### How to create a semantic search engine for fonts using Google Fonts, Supabase, and Mistral

This cookbook will assume you know your way around these tools. For a more accessible tutorial on semantic search, check out my guide on how to [build your own color search engine](https://lui.ie/guides/semantic-search-colors) which is a bit more beginner-friendly.

The use case: you're creating a website or logo and you need a font that captures something abstract like "silent sophistication" or "crisp clean with a little bit of soul". You can click around on Google Fonts, but the search function there seems to expect you to know the names of the fonts. You don't know the names of the fonts, that's why you're searching!

Strictly speaking we're talking about typefaces, not fonts - a font is a specific weight/style of a typeface family, while a typeface is the overall design. But the distinction has blurred over time and "fonts" just rolls off the tongue more easily, so I'll use that term throughout this guide.

I couldn't find any existing semantic search engines specifically for fonts, so I built one:

https://brandmint.ai/font-finder

You can build one too! Here's how:

## Step 0 - Have some source data

For this font search engine the source data is from [the github repo for Google Fonts](https://github.com/google/fonts), which is licensed under various permissive licenses.

This data has this structure:

TODO EXPAND HERE

## Step 1 - Create a PostgreSQL Database to hold the data

Supabase > new project > follow the flow to create a new PostgreSQL

Once it exists, the first thing you'll need to do is add the vector extension. In the SQL Editor: choose New SQL Snippet (Execute SQL Queries)

There are two queries to run here:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

![Step 1 Screenshot](./screenshots/step-1.png)

## Step 2 - Create a Table in the Database

Even though you've just added the `extensions` schema to support vectors, the `fonts` table itself will live in the `public` schema.

Supabase does have a UI for creating a new Table but it doesn't let you specify vector size, so you'll need to do this with a SQL command.

For our font data we're going to need the following columns:

- id (number is good for us here)
- created_at (timestamp defaulting to now - may be useful later if expanding the list)
- name (unique string - we don't want duplicate names pointing at different fonts)

TODO EXPAND HERE

- embedding_mistral_v1 (vector with 1024 dimensions)

Here's the SQL:

```sql
create table public.fonts (
id bigserial primary key,
created_at timestamp with time zone default now(),
name text not null unique,

TODO EXPAND HERE

embedding_mistral_v1 vector(1024)
);
```

You may get a security warning about Row Level Security. You can manually enable that on the table after creating it, then click "Add RLS Policy". When choosing a policy, I just used the Templates to enable read access for all users.

## Step 3 - Pull in the data source

Easy route: just copy paste the CSV into your repo and run script from there.

Sidequest: I want to pull in the font list via git so that it's easier to pull in future updates.

TODO CONVERT THIS SECTION TO FONTS

To sync first time:

```sh
git remote add canonical-color-list https://github.com/meodai/color-names.git
git fetch canonical-color-list
git checkout canonical-color-list/main -- src/colornames.csv
git add src/colornames.csv
git commit -m "Adding canonical color list from meodai/color-names"
git push origin main
```

To update later:

```sh
git fetch canonical-color-list
git checkout canonical-color-list/main -- src/colornames.csv
git commit -m "Update colornames.csv from meodai color-names"
git push
```

## Step 4 - Connect our codebase to Mistral

I'm using TypeScript.

First I create a simple client object with OpenAI (Mistral will come later):

```ts
import { Mistral } from "@mistralai/mistralai";

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set");
}

export const clientMistral = new Mistral({ apiKey });
```

Then a function to call it:

```ts
import { clientMistral } from "../connections/clientMistral";

const getEmbedding = async () => {
  // TODO EXPAND HERE
  return data;
};
```

Then a super simple script that calls the function:

```ts
const testRun = async () => {
  const embedding = await getEmbedding(["red"]);
  console.log(embedding);
  console.log(embedding.length);
};

testRun();
```

To run this, I use `bun`. So the Terminal command is:

```sh
bun src/script.ts
```

## Step 5 - Connect our codebase to Supabase

To connect your code with Supabase find your Project ID (find this in `Settings > General > Project Settings`).

It will look something like this: `abcdefghijklmnopqrst`

Your .env file will need a `SUPABASE_URL`, which will be built around the Project ID using this format:

`https://abcdefghijklmnopqrst.supabase.co`

Your `SUPABASE_SERVICE_ROLE_KEY` is a longer string that you'll find in `Settings > API Keys > Reveal`.

Here's the code to create your Supabase client on the server:

```ts
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const clientSupabase = createClient<Database>(supabaseUrl, supabaseKey);
```

Supabase gives you an npx script for generating a types file. Here's how to use it:

1. `npm i supabase`
2. `npx supabase login`
3. Follow the login flow in your browser
4. Generate TypeScript types: `npx supabase gen types typescript --project-id abcdefghijklmnopqrst > types/supabase.ts`

Save that script as a comment in your .env file, you will use it a ton!

## Step 6 - Define what DB-ready data looks like

Our `types/supabase.ts` file makes it nice and clear what shape our data needs to be in. So our target state is:

```ts
type PreppedFont = {
  // TODO EXPAND
};
```

And our write function is:

```ts
const saveFontEntry = async (preppedFont: PreppedFont) => {
  // TODO EXPAND
};
```

Having uniqueness enforced on the `name` column is handy here, it means we can upsert and use the `name` column to handle accidental rewrites of the same data.

## Step 7 - Write function to transform source data into DB-ready data

So we need to transform data that looks like this:

```csv
name,hex,good name
100 Mph,#c93f38,x

TODO CHANGE THIS

```

into this:

```ts
{
  name: "100 Mph";
  hex: "c93f38";
  is_good_name: true;
  embedding_openai_1536: "[-0.022126757,-0.010959357,-0.0027992798,0.019125007,0.017044587,...]";

  TODO CHANGE THIS


}
```

My ETL script for this looked like:

TODO ADD THIS

## Step 8 - Save our first few fonts to the database

At this point I ran my ETL script with `maxRows = 50` just to have something to test against.

## Step 9 - Add a Vector Index to the Database

The command you will want to run looks something like this:

```sql
CREATE INDEX CONCURRENTLY embedding_mistral_v1_ip_lists_30_idx
on public.fonts
using ivfflat (embedding_mistral_v1 vector_ip_ops)
with (lists = 30);
```

As far as I can tell the index name is never again touched by humans unless they're viewing a list of indices, so make it as long and specific as you like.

Let's explain the other parameter choices:

**ivfflat** = An index method optimized for high-dimensional vector data. It divides vectors into clusters for faster searching. The alternative would be `hnsw` (Hierarchical Navigable Small World) which can be faster but uses more memory.

**vector_ip_ops** aka internal product = Fast way to compare vectors that can only be used in conjunction with certain embedding models, those that have been unit normalised. Alternatives are `vector_l2_ops` (Euclidean distance) and `vector_cosine_ops` (cosine similarity). Thank you to Chris Loy for helping me out here, he wrote a good [explainer post](https://chrisloy.dev/post/2025/06/30/distance-metrics) that goes through the different options.

**lists** = Number of clusters to divide the vectors into. Generally: More lists give faster search but lower accuracy.

Microsoft gives the following [advice for tuning ivfflat](https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/howto-optimize-performance-pgvector):

1. Use lists equal to rows / 1000 for tables with up to 1 million rows and sqrt(rows) for larger datasets.
2. For probes start with lists / 10 for tables up to 1 million rows and sqrt(lists) for larger datasets.

So for 30,000 entires, that gives lists = 30, probes = 3. We'll use the probes value later.

⚠️ **Potential Gotcha: Memory Limits** ⚠️

You may hit the same problem I hit, which was that the working memory needed is higher than the default Supabase limits, and can't be increased via the interface! This is because the `SET maintenance_work_mem = '128MB';` command can't run inside a transaction block.

The workaround was to connect to the database via Terminal.

If you haven't done this before you'll need to install Postgres on your machine. For macOS using brew the command is:

```sh
brew install postgresql
```

Then connect in to the database with this command:

```sh
psql "host=aws-0-us-east-2.pooler.supabase.com dbname=postgres user=postgres.abcdefghijklmnopqrst"
```

Where...

- `us-east-2` is the datacentre you chose when setting up your project
- `abcdefghijklmnopqrst` is your Project Id
- you'll be prompted for a password, it's the password you gave when you first set up the database

I needed this psql command a few times and found it useful to store in .env for easy copy and paste, alongside the `npx supabase gen types` command.

Once connected to the database by command line, I was able to run this code.

```sql
SET maintenance_work_mem = '128MB';

CREATE INDEX CONCURRENTLY embedding_mistral_v1_ip_lists_30_idx
on public.fonts
using ivfflat (embedding_mistral_v1 vector_ip_ops)
with (lists = 30);
```

## Step 10 - Create an RPC Function to call that Vector Index from code

Usually when you want to call this DB from code you'll use the supabase SDK, and that will have predefined functions to let you add, delete, update etc.

Calling the vector index is beyond the scope of the current Supabase SDK, so we'll need to create our own custom function that we can call in a controlled way.

This is called an RPC (Remote Procedure Call) Function.

For our needs, we're going to want to query the embedding column, and get results back with `name`, `hex`, and `is_good_name` fields. We don't need to specify the index we're calling, as there should be only one for that column.

Here's the code for creating the index:

```sql
CREATE OR REPLACE FUNCTION search_embedding_mistral_v1(
  query_embedding vector(1024),
  match_count int default 10
)
RETURNS TABLE (
  name text,
  hex text,
  is_good_name boolean,
  distance float
  -- TODO UPDATE THIS
)
LANGUAGE sql VOLATILE
AS $$

  SET  ivfflat.probes = 3;

  SELECT
    c.name,
    c.hex,
    c.is_good_name,
      -- TODO UPDATE THIS
    c.embedding_mistral_v1 <#> query_embedding AS distance
  FROM (
    SELECT * FROM fonts
    ORDER BY embedding_mistral_v1 <#> query_embedding
    LIMIT match_count
  ) c;
$$;
```

Some explanations:

`ivfflat probes` - This sets how many IVF lists the index will scan during search. Higher values give more accurate results but slower queries.

`language sql volatile` - This tells Postgres that this is a SQL function that can modify data and its output may change even with the same inputs. 'volatile' means the function's result can vary even if called with identical parameters. This is required if we want to use a non-default number of ivfflat probes.

## Step 11 - Run a Test Query

At this stage I only have 50 entries in the database, but that's enough to test against.

```ts
const testQuery = async () => {
  const testEmbedding = await getEmbedding("very slick");
  const { data, error } = await clientSupabase.rpc(
    "search_embedding_openai_1536",
    {
      query_embedding: JSON.stringify(testEmbedding),
      match_count: 10,
    }
  );
};
```

Sure enough, a wuery for "very slick" gives us the named font "Garamond". Success!

## Step 12 - Add in all the data

At this point I added in all 30,355 entries. This took about 8 hours because I was too impatient to add in batching at the beginning.

- 🟢 Good news: It cost me only $0.02 of API costs for the embedding values.
- 🔴 Bad news: It pushed me over the database size limits on Supabase...

TODO REWRITE THIS

## Step 13 - Integrate with Frontend

In my case that's https://brandmint.ai/font-finder

The server code matches the pattern of a testQuery above.

## Other notes

- This workflow was extremely similar to something similar I did with colors last week, so it was less than N hours work.
- Embedding costs for this project were trivial. 30k entries came in under $0.02 for Mistral
- TODO add in more details

## Links

### Embedding Models

- Mistral https://docs.mistral.ai/capabilities/embeddings/overview/

### More Reading

- Distance Metrics https://chrisloy.dev/post/2025/06/30/distance-metrics
- Semantic Search https://supabase.com/docs/guides/ai/semantic-search

### Try It Out

If you just want to search for fonts, jump over to the [Font Finder on brandmint.ai](https://brandmint.ai/font-finder)
