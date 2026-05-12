'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Inbox, BarChart3, FileBarChart2,
  Sparkles, Upload, Users, Settings, BookOpen, ScrollText,
  ChevronRight, Search, Radio, Paperclip,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface Section {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  content: ContentBlock[]
}

type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'tip'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    subtitle: 'Your at-a-glance program overview',
    content: [
      { type: 'p', text: 'The Dashboard is the first screen you see after logging in. It gives you a real-time snapshot of your program\'s activity — recent submissions, form status, and key metrics — without having to dig into individual records.' },
      { type: 'h3', text: 'What you\'ll see' },
      { type: 'list', items: [
        'Recent submissions across all active forms',
        'A count of draft vs. submitted responses',
        'Quick links to your most-used forms',
        'Any submissions flagged for review',
      ]},
      { type: 'h3', text: 'Program switcher' },
      { type: 'p', text: 'If you manage more than one program, use the program switcher in the top-left of the sidebar. Everything in the app — forms, submissions, reports — is scoped to whichever program is currently selected.' },
      { type: 'tip', text: 'All staff see the dashboard, but only admins see flagged submissions and program-level stats.' },
    ],
  },
  {
    id: 'forms',
    icon: FileText,
    title: 'Forms',
    subtitle: 'Building, managing, and organizing your data collection',
    content: [
      { type: 'p', text: 'Forms are the foundation of the platform. Each form is a structured set of questions sent to team members, grantees, or program participants via a unique token link. Submissions are collected, stored, and used for reporting and AI analysis.' },
      { type: 'h3', text: 'Creating a form' },
      { type: 'steps', items: [
        'Go to Forms in the sidebar.',
        'Click "New form" to start from scratch, or "From template" to pre-fill a structure.',
        'Give your form a name and optional description, then click "Create & open."',
        'The form builder opens. Add pages and fields using the panel on the right.',
        'Use the Settings tab to assign a reporting period, set a confirmation message, or configure a redirect URL.',
        'Click "Publish" to make the form active, or leave it as a draft to keep editing.',
      ]},
      { type: 'h3', text: 'Form builder' },
      { type: 'p', text: 'The builder is a drag-and-drop editor. Fields can be reordered by dragging. Each field has its own settings — label, help text, whether it\'s required, and display logic (show/hide based on earlier answers).' },
      { type: 'list', items: [
        'Short text, long text, number, email, date',
        'Single choice, multiple choice, dropdown',
        'Rating, scale (1–10), NPS, slider',
        'Matrix / grid — rows and columns of radio buttons or checkboxes',
        'File upload, signature',
        'Section headers and instructional text for layout',
      ]},
      { type: 'h3', text: 'Multi-page forms' },
      { type: 'p', text: 'Forms can span multiple pages. The page tab bar appears at the top of the canvas — use the "+ Add page" button to add a new page. Each page can have its own title. On single-page forms the page header is hidden automatically to keep things clean.' },
      { type: 'h3', text: 'Preview link' },
      { type: 'p', text: 'Once a form is saved, you can share a read-only preview with anyone — no login or invitation needed. Open the Invites tab in the right panel and copy the Preview link. Visitors see the full form with an amber "Preview mode" banner and cannot submit responses.' },
      { type: 'h3', text: 'Who created a form' },
      { type: 'p', text: 'The All Forms list shows the creator\'s username next to the "Updated X ago" timestamp on each row. This is captured automatically when the form is created.' },
      { type: 'h3', text: 'Reporting period' },
      { type: 'p', text: 'Every form can be tagged with a reporting period (e.g. "Fall 2025" or a specific date range). This is what the AI report generator uses to pull the right data when you select a period — it matches by period, not by when the form was submitted.' },
      { type: 'warning', text: 'Always set a reporting period before publishing an import-based form. The AI reports won\'t find the data otherwise.' },
      { type: 'h3', text: 'Sending a form' },
      { type: 'p', text: 'Forms are sent via unique token links — each recipient gets their own link that expires after 30 days and can only be submitted once. Go to the form\'s Invites tab in the builder and use "Send invitations" to generate and email links.' },
      { type: 'h3', text: 'Folders and tabs' },
      { type: 'p', text: 'Use folders to organize forms (e.g. by program year or grant). Use tabs to create filtered views across your forms list — for example a "Q1 2025" tab that shows only forms from that period.' },
      { type: 'h3', text: 'Duplicating a form' },
      { type: 'p', text: 'Open the ⋯ menu on any form and click "Duplicate." This copies the structure and settings but not submissions. Useful for repeating a quarterly form.' },
      { type: 'h3', text: 'Saving as a template' },
      { type: 'p', text: 'If you\'ve built a form structure you\'ll reuse, open the ⋯ menu and click "Save as template." It\'s saved to your template library and can be shared with other programs.' },
      { type: 'tip', text: 'Auto-save is on — the builder saves your changes 2 seconds after you stop typing. Look for the "Saved HH:MM" indicator in the header.' },
    ],
  },
  {
    id: 'templates',
    icon: BookOpen,
    title: 'Templates',
    subtitle: 'Reusable form structures for your team',
    content: [
      { type: 'p', text: 'Templates are saved form shells — no submissions, just the structure. They live under Forms → Templates and can be shared across programs so your team doesn\'t rebuild the same forms from scratch.' },
      { type: 'h3', text: 'Creating a template' },
      { type: 'p', text: 'Templates are created from existing forms, not the other way around. Build your form in the normal form editor, get the structure exactly right, then save it as a template:' },
      { type: 'steps', items: [
        'Go to Forms and open (or create) the form you want to save.',
        'Open the ⋯ menu on the form card, or use the menu inside the builder.',
        'Click "Save as template."',
        'Give the template a name and optional description.',
        'It\'s now in your Templates library.',
      ]},
      { type: 'h3', text: 'Using a template' },
      { type: 'steps', items: [
        'From the Forms list, click "From template" (next to "New form").',
        'Search or browse the list of templates.',
        'Click a template to create an independent copy as a new form.',
        'You\'re taken straight to the form builder to customize it.',
      ]},
      { type: 'p', text: 'Editing the new form never affects the template it came from. Templates are just starting points.' },
      { type: 'h3', text: 'Global vs. program templates' },
      { type: 'p', text: 'Site admins can mark templates as "Global" — visible to all programs. Program-level templates are only visible within that program.' },
      { type: 'h3', text: 'Folders' },
      { type: 'p', text: 'Templates support the same folder organization as forms. Use folders to group by use case (e.g. "Site Visits," "Quarterly Reports," "Onboarding").' },
      { type: 'tip', text: 'The Templates screen is a library view only — you can\'t create templates directly from there. Always start in the Forms editor and save-as-template when you\'re happy with the structure.' },
    ],
  },
  {
    id: 'submissions',
    icon: Inbox,
    title: 'Submissions',
    subtitle: 'Viewing, reviewing, and managing responses',
    content: [
      { type: 'p', text: 'The Submissions screen shows every response collected across your program\'s forms. You can filter by form, status, date, or respondent, and review individual answers.' },
      { type: 'h3', text: 'Submission statuses' },
      { type: 'list', items: [
        'Draft — the respondent started but hasn\'t submitted yet.',
        'Submitted — complete and ready for review.',
        'Reviewed — a staff member has marked it as reviewed.',
        'Flagged — marked for follow-up (stored separately from the normal status flow).',
        'Unassigned — submissions with no respondent email linked. Use the Unassigned filter tab to find and triage these.',
      ]},
      { type: 'h3', text: 'Bulk selecting and assigning' },
      { type: 'p', text: 'Each submission row has a checkbox on the left. Select one or more submissions and an action bar appears at the top of the list. From there you can assign them all to a contact email at once — useful when cleaning up imported data or reassigning a departing team member\'s submissions.' },
      { type: 'steps', items: [
        'Check the box on any submission row (or use the header checkbox to select all visible).',
        'The action bar appears with a count of selected items.',
        'Click "Assign to contact," enter the email address, and confirm.',
      ]},
      { type: 'h3', text: 'Unassigned filter' },
      { type: 'p', text: 'Click the "Unassigned" tab in the filter bar to see only submissions that have no respondent email. This is common after a CSV import where the email column was empty.' },
      { type: 'h3', text: 'Reviewing a submission' },
      { type: 'p', text: 'Click any submission to open the detail view. You\'ll see every field and its answer, the respondent\'s email, and when it was submitted.' },
      { type: 'h3', text: 'Flagging' },
      { type: 'p', text: 'Use the Flag option to mark a submission that needs attention. Flagged submissions appear in their own filtered view and show an amber indicator.' },
      { type: 'h3', text: 'Reviewer comments and sending feedback' },
      { type: 'p', text: 'On a flagged submission, you\'ll see a "Reviewer notes" card. Type your comments and click "Send feedback to submitter" — this emails the respondent directly with your notes. The sent timestamp is recorded.' },
      { type: 'h3', text: 'Exporting submissions' },
      { type: 'p', text: 'Use the Export button to download submissions as a CSV. You can filter before exporting to get exactly the rows you need.' },
      { type: 'tip', text: 'Submitters can save their progress partway through and return to their form link later. Their draft is stored and pre-filled automatically.' },
    ],
  },
  {
    id: 'pulse',
    icon: Radio,
    title: 'Pulse',
    subtitle: 'Field notes, observations, and qualitative context',
    content: [
      { type: 'p', text: 'Pulse is where your team captures qualitative observations — site visit notes, meeting summaries, anecdotes, photos, and documents — outside of formal form submissions. These notes feed directly into the AI tools so the Sidekick and Report generator can incorporate field observations alongside structured data.' },
      { type: 'h3', text: 'Writing a field note' },
      { type: 'steps', items: [
        'Go to Pulse in the sidebar.',
        'Type your note in the compose area at the top.',
        'Add an optional title and set the date (defaults to today).',
        'Attach files if relevant (PDFs, images).',
        'Click "Save note."',
      ]},
      { type: 'h3', text: 'Attaching files' },
      { type: 'p', text: 'Click the paperclip icon to attach PDFs or images to a note. PDFs are automatically read by Claude at upload time — their full text content is extracted and stored so the AI can reference it. Images are stored and labeled but their visual content isn\'t described automatically.' },
      { type: 'tip', text: 'If a PDF was uploaded before text extraction was working, go to the Files page and click the amber refresh icon next to that file to extract its text now.' },
      { type: 'h3', text: 'Voice notes' },
      { type: 'p', text: 'Click the microphone icon to record a voice note. Your speech is transcribed automatically and saved as the note body. Useful for quick observations captured in the field.' },
      { type: 'h3', text: 'Google Docs' },
      { type: 'p', text: 'Paste a Google Doc URL and the note will pull in the document\'s content automatically. The source is labeled "Google Doc" so you can distinguish it from typed or voice notes.' },
      { type: 'h3', text: 'How Pulse feeds the AI' },
      { type: 'p', text: 'Every time the Evaluation Sidekick answers a question, or the Report generator creates a section, it includes your Pulse field notes as context — alongside submission data. PDF attachment text is included in full (up to ~12,000 characters per file). This means observations your team captures in the field directly inform AI-generated narratives and analyses.' },
      { type: 'h3', text: 'Editing and deleting notes' },
      { type: 'p', text: 'Hover over any note to reveal the edit (pencil) and delete (trash) icons. Editing opens the same compose form pre-filled with the existing content.' },
      { type: 'warning', text: 'Deleting a Pulse note also removes its attachments from storage permanently. This cannot be undone.' },
    ],
  },
  {
    id: 'files',
    icon: Paperclip,
    title: 'Files',
    subtitle: 'A repository of all Pulse attachments',
    content: [
      { type: 'p', text: 'The Files page gives admins a searchable, sortable view of every file that\'s been attached to a Pulse field note — PDFs, images, and other documents — in one place.' },
      { type: 'h3', text: 'What you\'ll see' },
      { type: 'list', items: [
        'File name and type (PDF, PNG, JPG, etc.)',
        'The Pulse note it came from and the note date',
        'The author who uploaded it',
        'File size',
        'A "Text extracted" badge on PDFs whose content has been read by the AI',
      ]},
      { type: 'h3', text: 'Searching and filtering' },
      { type: 'p', text: 'Use the search box to filter by file name, note title, or author. Use the type filter (All / PDF / Image) to narrow by file type. Click any column header to sort by that column.' },
      { type: 'h3', text: 'Downloading files' },
      { type: 'p', text: 'Click the download icon on any row to open or save the file directly.' },
      { type: 'h3', text: 'Re-extracting PDF text' },
      { type: 'p', text: 'PDFs uploaded before text extraction was enabled will show an amber refresh icon instead of the "Text extracted" badge. Click it to run extraction now — Claude reads the PDF and stores the text so the Sidekick and Reports can reference it going forward.' },
      { type: 'warning', text: 'The Files page is only visible to Site Admins and Program Admins.' },
    ],
  },
  {
    id: 'reports',
    icon: FileBarChart2,
    title: 'Reports',
    subtitle: 'Written narrative reports with AI-assisted drafting',
    content: [
      { type: 'p', text: 'Reports are free-form written documents that live alongside your data. They\'re where you write your narrative — program summaries, grant reports, impact stories — supported by an AI section generator that pulls from your actual submissions and Pulse field notes.' },
      { type: 'h3', text: 'Creating a report' },
      { type: 'steps', items: [
        'Go to Reports in the sidebar.',
        'Click "New report" and give it a title.',
        'You\'re taken to the report editor.',
      ]},
      { type: 'h3', text: 'Writing and formatting' },
      { type: 'p', text: 'The editor supports headings (H2, H3), bold, italic, bullet lists, numbered lists, blockquotes, and horizontal rules. It auto-saves 3 seconds after you stop typing.' },
      { type: 'h3', text: 'AI section generator' },
      { type: 'p', text: 'The right-hand panel is your AI assistant. Select a date range (or reporting period), choose which forms to include, pick a section type, and click "Insert AI section." The AI reads your actual submission data and any Pulse field notes from that period and writes a draft section directly into the editor.' },
      { type: 'list', items: [
        'Key Themes — identifies 4–6 prominent themes with supporting data.',
        'Trend Analysis — compares patterns across the selected period.',
        'Impact Story — a narrative framing real outcomes for funders.',
        'Logic Model — structures inputs, activities, outputs, and outcomes.',
      ]},
      { type: 'h3', text: 'Reporting period vs. date range' },
      { type: 'p', text: 'Use "Reporting period" to pull data from forms that were tagged with a specific period (e.g. Fall 2025). Use "Date range" for custom date windows. The period mode is more reliable for imported data.' },
      { type: 'h3', text: 'Publishing and downloading' },
      { type: 'p', text: 'Click "Mark as final" to publish a report (visible in the list as "Final"). Download any report as a .docx Word file using the export button in the header.' },
      { type: 'tip', text: 'The AI generator uses both Award Context documents and Pulse field notes to ground its analysis. Add award documents under Settings → Award Context, and keep Pulse notes up to date for richer AI-generated narratives.' },
    ],
  },
  {
    id: 'impact',
    icon: BarChart3,
    title: 'Impact Dashboard',
    subtitle: 'Visual charts and metrics across your program data',
    content: [
      { type: 'p', text: 'The Impact Dashboard turns your submission data into visual charts — bar charts, line trends, and summary cards — so you can see program performance at a glance without writing a report.' },
      { type: 'h3', text: 'How it works' },
      { type: 'p', text: 'The dashboard automatically detects numeric and choice fields across your forms and builds charts from them. Each chart shows data aggregated across all submissions for that field.' },
      { type: 'h3', text: 'Date filtering' },
      { type: 'p', text: 'Use the date range picker at the top to filter which submissions are included. Charts update instantly.' },
      { type: 'h3', text: 'AI summary' },
      { type: 'p', text: 'The "Generate summary" button at the top uses the same AI as the Report editor to write a narrative interpretation of what the dashboard is showing.' },
      { type: 'tip', text: 'Import your historical data (see Import Data) and it will appear in the Impact Dashboard automatically, charted by reporting period.' },
    ],
  },
  {
    id: 'sidekick',
    icon: Sparkles,
    title: 'Evaluation Sidekick',
    subtitle: 'Conversational AI for your program data',
    content: [
      { type: 'p', text: 'Evaluation Sidekick is a chat interface that lets you ask natural language questions about your program data. Ask about trends, comparisons, outliers — anything — and it responds based on your actual submissions, Pulse field notes, and attached documents.' },
      { type: 'h3', text: 'Getting started' },
      { type: 'p', text: 'Click "Evaluation Sidekick" in the sidebar. Type your question in the input at the bottom and press Enter (Shift+Enter for a new line). The Sidekick streams a response word by word.' },
      { type: 'h3', text: 'What it knows' },
      { type: 'p', text: 'Every time you ask a question, it loads all submitted data for your current program — forms, fields, responses, and your most recent 100 Pulse field notes — and uses that as context. Numeric fields are pre-aggregated by month so trend questions work well.' },
      { type: 'list', items: [
        'Numeric fields: monthly count, sum, average, min, max',
        'Choice fields: value distributions',
        'Text fields: sample responses',
        'Pulse field notes: full note content (up to 1,200 characters each)',
        'PDF attachments on Pulse notes: full extracted text (up to 12,000 characters per file)',
      ]},
      { type: 'h3', text: 'Asking about uploaded documents' },
      { type: 'p', text: 'If your team has attached PDFs to Pulse notes, the Sidekick can read and discuss their contents. For example: "What did the ExtensionBot pilot results PDF say about satisfaction scores?" The PDF\'s text must have been extracted first — check the Files page for any PDFs with the amber refresh icon and extract those before asking.' },
      { type: 'h3', text: 'Multi-turn conversation' },
      { type: 'p', text: 'The Sidekick remembers earlier messages in the conversation, so you can ask follow-up questions like "how does that compare to last quarter?" without repeating yourself.' },
      { type: 'h3', text: 'Example questions' },
      { type: 'list', items: [
        '"What\'s the trend in Connect Extension users from Jan to Dec 2025?"',
        '"What did the site visit notes say about participant engagement this quarter?"',
        '"How many WordPress websites were reported and how does that compare to Extension users?"',
        '"Which form had the most submissions last quarter?"',
        '"Are there any fields where numbers dropped significantly year over year?"',
        '"Give me a summary of all qualitative responses about challenges."',
        '"What does the attached pilot results PDF say about satisfaction scores?"',
      ]},
      { type: 'p', text: 'Click "New conversation" in the top-right to reset the thread and start fresh.' },
      { type: 'tip', text: 'The more Pulse field notes your team writes — especially with attached PDFs — the richer the Sidekick\'s answers will be. Structured submission data and qualitative field observations together give it the full picture.' },
    ],
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import Data',
    subtitle: 'Bringing historical or external data into the platform',
    content: [
      { type: 'p', text: 'Import Data lets you upload a CSV file of existing data — from another system, a spreadsheet, or a previous reporting tool — and bring it into the platform so it appears in reports and the Impact Dashboard.' },
      { type: 'h3', text: 'How to import' },
      { type: 'steps', items: [
        'Go to Settings → Import Data.',
        'Upload your CSV file.',
        'Review the AI-detected field types. Adjust any columns that were misidentified.',
        'Use "Don\'t import" on columns you want to skip.',
        'Set the reporting period — this is required before confirming.',
        'Click "Confirm import."',
      ]},
      { type: 'h3', text: 'Field type detection' },
      { type: 'p', text: 'The importer uses AI plus heuristics to guess the type of each column. Fields with names like "# of sites" or "total participants" are detected as numeric. Email addresses, dates, and yes/no fields are also detected automatically. You can override any detection before confirming.' },
      { type: 'h3', text: 'Reporting period is required' },
      { type: 'p', text: 'You must set a reporting period before the Confirm button becomes active. This is what links imported data to the right time window in reports and the Sidekick.' },
      { type: 'h3', text: 'After import' },
      { type: 'p', text: 'A new form is created automatically in your Forms list, named after the file. All imported rows become submissions on that form. The form\'s reporting period is set to whatever you chose during import.' },
      { type: 'warning', text: 'Each import creates a permanent form and its submissions. Use the ⋯ menu on the import job to delete it if you need to redo an import — this removes both the form and all its submissions.' },
      { type: 'h3', text: 'CSV formatting tips' },
      { type: 'list', items: [
        'The first row must be column headers.',
        'Quoted fields with commas or line breaks are handled correctly.',
        'Numbers can include $, commas, %, K, M suffixes (e.g. "$1,500" → 1500, "300K" → 300000).',
      ]},
    ],
  },
  {
    id: 'award-context',
    icon: BookOpen,
    title: 'Award Context',
    subtitle: 'Grounding AI analysis in your program\'s goals',
    content: [
      { type: 'p', text: 'Award Context documents give the AI a foundation to work from. When generating report sections or Sidekick responses, the AI reads these documents and uses them to connect your submission data back to the program\'s stated goals and theory of change.' },
      { type: 'h3', text: 'Document types supported' },
      { type: 'list', items: [
        'Grant Narrative — the original program narrative from your grant application.',
        'Logic Model — inputs, activities, outputs, outcomes framework.',
        'Continuation Document — renewal or continuation narratives.',
        'Evaluation Plan — your stated evaluation methodology.',
        'Budget Narrative — financial context.',
        'Supporting Document — anything else relevant.',
      ]},
      { type: 'h3', text: 'Adding a document' },
      { type: 'steps', items: [
        'Go to Settings → Award Context.',
        'Click "Add document."',
        'Choose the document type.',
        'Set the date range it covers (e.g. Oct 2023 – Sep 2026 for a 3-year grant).',
        'Paste the text content and save.',
      ]},
      { type: 'h3', text: 'How dates work' },
      { type: 'p', text: 'Documents are matched to AI requests by date overlap. If you generate a report for Q1 2025 and you have a grant narrative covering 2023–2026, that narrative is automatically included. Multiple documents covering the same period are all included together.' },
      { type: 'tip', text: 'Paste the full text of your documents — the AI reads them completely and uses the language from your actual grant to frame its analysis.' },
    ],
  },
  {
    id: 'users',
    icon: Users,
    title: 'Users & Roles',
    subtitle: 'Managing who has access and what they can do',
    content: [
      { type: 'p', text: 'Access is controlled by roles. Each person is assigned a role within a specific program. Someone can be an admin in one program and a viewer in another.' },
      { type: 'h3', text: 'Role levels' },
      { type: 'list', items: [
        'Site Admin (super_admin) — full access to all programs, all settings, user management, and the audit log.',
        'Program Admin — full access within their program: create/edit forms, view and manage submissions, manage team members.',
        'Staff — can view and create forms, view submissions, send invitations. Cannot delete forms or manage users.',
        'Viewer — read-only access to submissions and reports. Cannot see raw submission PII.',
      ]},
      { type: 'h3', text: 'Inviting a team member' },
      { type: 'steps', items: [
        'Go to Settings → Users & Roles.',
        'Click "Invite member."',
        'Enter their email address and select their role.',
        'They receive an invitation email with a login link.',
      ]},
      { type: 'h3', text: 'Changing a role' },
      { type: 'p', text: 'Open the ⋯ menu next to any team member and select "Change role." Changes take effect immediately.' },
      { type: 'warning', text: 'Only Site Admins and Program Admins can manage users. Be careful when assigning admin roles — admins can delete forms and submissions.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Program Settings',
    subtitle: 'Configuring your program\'s details and branding',
    content: [
      { type: 'p', text: 'Program Settings lets you update the name, description, and brand color for your program. The brand color is used on public-facing form pages so respondents see your program\'s identity.' },
      { type: 'h3', text: 'What you can configure' },
      { type: 'list', items: [
        'Program name — shown in emails, form pages, and the sidebar switcher.',
        'Description — internal reference only.',
        'Brand color — used as the accent color on public form pages and submission buttons.',
        'Program slug — the URL-safe identifier (cannot be changed after creation).',
      ]},
      { type: 'tip', text: 'If you manage multiple programs, each has its own brand color. Respondents see the color of the program that owns the form they\'re filling out.' },
    ],
  },
  {
    id: 'audit',
    icon: ScrollText,
    title: 'Audit Log',
    subtitle: 'A record of every significant action in the system',
    content: [
      { type: 'p', text: 'The Audit Log records every meaningful change made in the platform — who did what and when. It\'s available to Site Admins and Program Admins and is read-only.' },
      { type: 'h3', text: 'What gets logged' },
      { type: 'list', items: [
        'Form created, updated, deleted, published',
        'Submission reviewed, flagged, updated',
        'User invited, role changed, removed',
        'Import confirmed or deleted',
        'Report created or updated',
        'Tokens sent',
      ]},
      { type: 'h3', text: 'Filtering the log' },
      { type: 'p', text: 'Use the search and filter controls to find entries by action type, user, or date range. Each entry shows the actor, the action, the affected record, and a timestamp.' },
      { type: 'tip', text: 'The audit log is append-only — entries cannot be edited or deleted, even by site admins. This makes it a reliable paper trail.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function renderBlock(block: ContentBlock, i: number) {
  switch (block.type) {
    case 'h3':
      return <h3 key={i} className="text-[14px] font-semibold text-gray-800 mt-6 mb-2">{block.text}</h3>
    case 'p':
      return <p key={i} className="text-[13px] text-gray-600 leading-relaxed">{block.text}</p>
    case 'tip':
      return (
        <div key={i} className="flex gap-2.5 rounded-lg bg-orange-50 border border-orange-100 px-3.5 py-3 mt-4">
          <span className="text-orange-500 text-[13px] font-semibold flex-shrink-0">Tip:</span>
          <p className="text-[13px] text-orange-800 leading-relaxed">{block.text}</p>
        </div>
      )
    case 'warning':
      return (
        <div key={i} className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-3 mt-4">
          <span className="text-amber-600 text-[13px] font-semibold flex-shrink-0">Note:</span>
          <p className="text-[13px] text-amber-800 leading-relaxed">{block.text}</p>
        </div>
      )
    case 'steps':
      return (
        <ol key={i} className="mt-2 space-y-1.5">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-[13px] text-gray-600 leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">{j + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul key={i} className="mt-2 space-y-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-2 text-[13px] text-gray-600 leading-relaxed">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuideClient() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)
  const [search, setSearch] = useState('')

  const activeSection = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0]

  const filteredSections = search.trim()
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        s.content.some(b =>
          ('text' in b && b.text.toLowerCase().includes(search.toLowerCase())) ||
          ('items' in b && b.items.some(i => i.toLowerCase().includes(search.toLowerCase())))
        )
      )
    : SECTIONS

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left nav */}
      <aside className="w-[220px] flex-shrink-0 border-r bg-white overflow-y-auto flex flex-col">
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-[15px] font-semibold text-gray-900">User Guide</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">How everything works</p>
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 text-[12px] pl-7"
            />
          </div>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {filteredSections.map(s => {
            const active = s.id === activeId && !search
            return (
              <button
                key={s.id}
                onClick={() => { setActiveId(s.id); setSearch('') }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors',
                  active
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <s.icon className={cn('h-3.5 w-3.5 flex-shrink-0', active ? 'text-orange-500' : 'text-gray-400')} />
                {s.title}
              </button>
            )
          })}
          {filteredSections.length === 0 && (
            <p className="px-2.5 py-4 text-[12px] text-gray-400 italic">No sections match.</p>
          )}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {search && filteredSections.length > 0 ? (
          // Search results mode — show matching sections stacked
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-10">
            <p className="text-[12px] text-gray-400">{filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''} match &ldquo;{search}&rdquo;</p>
            {filteredSections.map(s => (
              <div key={s.id}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                    <s.icon className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-gray-900">{s.title}</h2>
                    <p className="text-[12px] text-gray-400">{s.subtitle}</p>
                  </div>
                </div>
                <div className="space-y-3">{s.content.map((b, i) => renderBlock(b, i))}</div>
                <button
                  onClick={() => { setActiveId(s.id); setSearch('') }}
                  className="mt-4 flex items-center gap-1 text-[12px] text-orange-600 hover:text-orange-700 font-medium"
                >
                  Read full section <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Single section mode
          <div className="max-w-2xl mx-auto px-8 py-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <activeSection.icon className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-gray-900">{activeSection.title}</h2>
                <p className="text-[13px] text-gray-400">{activeSection.subtitle}</p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
              {activeSection.content.map((b, i) => renderBlock(b, i))}
            </div>

            {/* Bottom nav */}
            <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
              {(() => {
                const idx = SECTIONS.findIndex(s => s.id === activeId)
                const prev = SECTIONS[idx - 1]
                const next = SECTIONS[idx + 1]
                return (
                  <>
                    <div>
                      {prev && (
                        <button onClick={() => setActiveId(prev.id)} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
                          <ChevronRight className="h-3 w-3 rotate-180" /> {prev.title}
                        </button>
                      )}
                    </div>
                    <div>
                      {next && (
                        <button onClick={() => setActiveId(next.id)} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
                          {next.title} <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
