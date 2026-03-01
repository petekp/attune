export const RSS_ITEMS = [
  { title: "Claude 4 Sets New Benchmarks in Reasoning Tasks", source: "TechCrunch", summary: "Anthropic's latest model shows significant improvements in mathematical reasoning and code generation.", url: "https://example.com/1" },
  { title: "EU Passes Comprehensive AI Regulation Framework", source: "Reuters", summary: "The European Union has finalized rules requiring AI companies to disclose training data and implement safety measures.", url: "https://example.com/2" },
  { title: "SpaceX Starship Completes First Orbital Refueling Test", source: "Ars Technica", summary: "The successful test brings Mars missions one step closer to reality.", url: "https://example.com/3" },
  { title: "New CRISPR Technique Cures Sickle Cell in Clinical Trial", source: "Nature", summary: "A gene editing breakthrough shows 95% efficacy in treating sickle cell disease in a Phase 3 trial.", url: "https://example.com/4" },
  { title: "Bitcoin Surges Past $150K on ETF Inflows", source: "Bloomberg", summary: "Institutional demand through spot Bitcoin ETFs pushes the cryptocurrency to new all-time highs.", url: "https://example.com/5" },
  { title: "OpenAI Launches Autonomous Research Agent", source: "Wired", summary: "The new agent can independently design and execute multi-day research projects with human oversight.", url: "https://example.com/7" },
  { title: "Rust Overtakes C++ in Systems Programming Adoption", source: "InfoWorld", summary: "Annual developer survey shows Rust as the preferred language for new systems projects for the first time.", url: "https://example.com/9" },
  { title: "DeepMind Solves Major Protein Folding Challenge", source: "Science", summary: "AlphaFold 4 accurately predicts protein interactions, opening doors to rapid drug discovery.", url: "https://example.com/11" },
  { title: "GitHub Copilot Now Writes 60% of Code at Fortune 500 Companies", source: "Forbes", summary: "AI pair programming tools have become the default development workflow in enterprise software.", url: "https://example.com/15" },
  { title: "Japan Launches World's First Commercial Fusion Reactor", source: "Nikkei", summary: "The 50MW reactor in Osaka marks a historic milestone in clean energy production.", url: "https://example.com/16" },
];

export const USER_PROFILE = `Software engineer and product designer interested in:
- AI/ML developments (especially LLMs, agents, and developer tools)
- Programming languages and developer experience
- Science breakthroughs with practical applications
- Tech industry trends that affect startups
Less interested in: pure finance, politics, celebrity news, sports.`;

export const INITIAL_PROMPT = `You are a morning briefing curator. Given a list of RSS items and a user profile, select the 3 most relevant and interesting items. Produce a concise briefing paragraph that highlights why each item matters to the user.

User profile:
${USER_PROFILE}

Respond with JSON:
{
  "selectedItems": [{ "title": "...", "source": "...", "summary": "...", "url": "..." }, ...],
  "briefing": "A concise morning briefing paragraph."
}`;
