import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { Lead, LeadIntent, LeadStats } from './types';

export function classifyIntent(title: string, body: string): LeadIntent {
  const text = `${title} ${body}`.toLowerCase();

  // Check explicit tags first
  if (text.includes('[hiring]') || text.includes('hiring:') || text.includes('[client]')) {
    return 'HIRING';
  }
  if (text.includes('[for hire]') || text.includes('[forhire]') || text.includes('for hire:')) {
    return 'FOR_HIRE';
  }

  // Strong hiring signals
  const hiringPatterns = [
    /\blooking for (a |an )?(developer|engineer|freelancer|expert|agency|consultant)\b/i,
    /\bneed (someone|a developer|help|an expert|to build|automation)\b/i,
    /\bwant to hire\b/i,
    /\bseeking (a |an )?(developer|consultant|expert)\b/i,
    /\bbudget\s*:\s*\$/i,
    /\bpaying\s*\$/i,
    /\blooking to hire\b/i,
  ];

  for (const pat of hiringPatterns) {
    if (pat.test(text)) {
      return 'HIRING';
    }
  }

  // Offering signals
  const offeringPatterns = [
    /\bi (can )?build\b/i,
    /\bi offer\b/i,
    /\bportfolio\s*:\s*/i,
    /\bavailable for\b/i,
    /\bmy rate\b/i,
    /\bhire me\b/i,
  ];

  for (const pat of offeringPatterns) {
    if (pat.test(text)) {
      return 'FOR_HIRE';
    }
  }

  return 'DISCUSSION';
}

export function extractContacts(text: string): string {
  const emails = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi) || [];
  const telegramMatches = Array.from(text.matchAll(/(?:t\.me\/|telegram:\s*@?)([a-zA-Z0-9_]+)/gi));
  const telegrams = telegramMatches.map((m) => m[1]);
  const discordMatches = Array.from(text.matchAll(/(?:discord:\s*|discordapp\.com\/users\/)([a-zA-Z0-9_.#]+)/gi));
  const discords = discordMatches.map((m) => m[1]);
  const calendly = text.match(/calendly\.com\/[a-zA-Z0-9_-]+/gi) || [];

  const contacts: string[] = [];
  if (emails.length) {
    const unique = Array.from(new Set(emails));
    contacts.push(...unique.map((e) => `Email: ${e}`));
  }
  if (telegrams.length) {
    const unique = Array.from(new Set(telegrams));
    contacts.push(...unique.map((t) => `TG: @${t}`));
  }
  if (discords.length) {
    const unique = Array.from(new Set(discords));
    contacts.push(...unique.map((d) => `Discord: ${d}`));
  }
  if (calendly.length) {
    const unique = Array.from(new Set(calendly));
    contacts.push(...unique.map((c) => `Calendar: ${c}`));
  }

  return contacts.length > 0 ? contacts.join('; ') : 'None';
}

export function extractBudget(text: string): string {
  const rates = text.match(/(\$[0-9]+(?:\.[0-9]{2})?(?:\s*-\s*\$[0-9]+(?:\.[0-9]{2})?)?(?:\/hr|\/hour|\/mo|\/month|\s*fixed)?)/gi);
  if (rates && rates.length > 0) {
    const unique = Array.from(new Set(rates)).slice(0, 3);
    return unique.join(', ');
  }
  return 'N/A';
}

function generateLeadId(url: string, index: number): string {
  if (!url) return `lead-${index}`;
  const parts = url.split('/comments/');
  if (parts.length > 1) {
    const subParts = parts[1].split('/');
    if (subParts[0]) return subParts[0];
  }
  return `lead-${index}`;
}

export async function getLeadsAndStats(): Promise<{ leads: Lead[]; stats: LeadStats }> {
  const cwd = process.cwd();
  const redditCsvPath = path.join(cwd, 'data', 'reddit_results.csv');
  const hiringCsvPath = path.join(cwd, 'data', 'hiring_leads.csv');

  let rawRows: any[] = [];
  let hiringMap = new Map<string, any>();

  // 1. Load hiring_leads.csv for override/quick lookup if present
  if (fs.existsSync(hiringCsvPath)) {
    const hiringFile = fs.readFileSync(hiringCsvPath, 'utf8');
    const parsedHiring = Papa.parse(hiringFile, { header: true, skipEmptyLines: true });
    for (const r of parsedHiring.data as any[]) {
      if (r.url) {
        hiringMap.set(r.url.trim(), r);
      }
    }
  }

  // 2. Load reddit_results.csv
  if (fs.existsSync(redditCsvPath)) {
    const redditFile = fs.readFileSync(redditCsvPath, 'utf8');
    const parsedReddit = Papa.parse(redditFile, { header: true, skipEmptyLines: true });
    rawRows = parsedReddit.data as any[];
  }

  const leads: Lead[] = [];
  const subCounts: Record<string, number> = {};
  const kwCounts: Record<string, number> = {};
  let hiringCount = 0;
  let forHireCount = 0;
  let discussionCount = 0;
  let contactableCount = 0;
  let budgetCount = 0;

  rawRows.forEach((row, index) => {
    const url = (row.url || '').trim();
    const title = (row.title || '').trim();
    const body = (row.body_text || '').trim();
    const subreddit = (row.subreddit || 'unknown').trim().toLowerCase();
    const keywordMatched = (row.keyword_matched || 'unspecified').trim();
    const score = parseInt(row.score || '0', 10) || 0;
    const createdDate = row.created_date || new Date().toISOString();

    const isExplicitHiring = hiringMap.has(url);
    const hiringRow = hiringMap.get(url);

    const intent: LeadIntent = isExplicitHiring
      ? 'HIRING'
      : classifyIntent(title, body);

    const contacts = isExplicitHiring && hiringRow?.contacts && hiringRow.contacts !== 'None'
      ? hiringRow.contacts
      : extractContacts(`${title} ${body}`);

    const budget = isExplicitHiring && hiringRow?.budget_signals && hiringRow.budget_signals !== 'N/A'
      ? hiringRow.budget_signals
      : extractBudget(`${title} ${body}`);

    // Track counts
    if (intent === 'HIRING') hiringCount++;
    else if (intent === 'FOR_HIRE') forHireCount++;
    else discussionCount++;

    if (contacts !== 'None') contactableCount++;
    if (budget !== 'N/A') budgetCount++;

    subCounts[subreddit] = (subCounts[subreddit] || 0) + 1;

    // split combined keywords if present
    const splitKws = keywordMatched.split(',').map((k: string) => k.trim());
    splitKws.forEach((kw: string) => {
      if (kw) {
        kwCounts[kw] = (kwCounts[kw] || 0) + 1;
      }
    });

    // Default stage: Hiring leads start in 'inbox', others can be filtered
    leads.push({
      id: generateLeadId(url, index),
      subreddit,
      keyword_matched: keywordMatched,
      title,
      body_text: body,
      url,
      score,
      created_date: createdDate,
      intent,
      contacts,
      budget_signals: budget,
      stage: intent === 'HIRING' ? 'qualified' : 'inbox',
    });
  });

  const stats: LeadStats = {
    totalPosts: leads.length,
    hiringCount,
    forHireCount,
    discussionCount,
    contactableCount,
    budgetCount,
    subredditBreakdown: subCounts,
    keywordBreakdown: kwCounts,
    totalSpend: '$0.72',
    lastScraped: leads.length > 0 ? leads[0].created_date : new Date().toISOString(),
  };

  return { leads, stats };
}
