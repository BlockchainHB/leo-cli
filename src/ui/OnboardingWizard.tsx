/**
 * Onboarding Wizard
 *
 * Clean, compact setup wizard with Leo's orange theme.
 * Based on CLI UX best practices from clig.dev and ink-ui.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import {
  TextInput,
  PasswordInput,
  Select,
  Spinner,
  ProgressBar,
  StatusMessage,
  ThemeProvider,
  extendTheme,
  defaultTheme
} from '@inkjs/ui';
import Gradient from 'ink-gradient';
import { LeoConfig, mergeWithDefaults } from '../types/config.js';
import { saveConfig } from '../utils/config-manager.js';
import { theme, claude } from './colors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'api-key' | 'blog-name' | 'blog-url' | 'author' | 'niche' | 'audience' | 'voice' | 'cms' | 'confirm' | 'saving' | 'complete';

interface OnboardingWizardProps {
  onComplete: (config: LeoConfig) => void;
  onCancel: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Theme - Match Leo's orange accent
// ─────────────────────────────────────────────────────────────────────────────

const leoTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: '#f97316' })
      }
    },
    ProgressBar: {
      styles: {
        completed: () => ({ color: '#f97316' }),
        remaining: () => ({ color: '#404040' })
      }
    },
    TextInput: {
      styles: {
        value: () => ({ color: '#e5e5e5' }),
        placeholder: () => ({ color: '#525252' })
      }
    },
    Select: {
      styles: {
        highlightedIndicator: () => ({ color: '#f97316' }),
        highlightedLabel: () => ({ color: '#f97316' })
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

const NICHE_OPTIONS = [
  { label: 'Technology & Software', value: 'technology' },
  { label: 'Business & Marketing', value: 'business' },
  { label: 'Health & Wellness', value: 'health' },
  { label: 'Finance & Investing', value: 'finance' },
  { label: 'Education & Learning', value: 'education' },
  { label: 'E-commerce & Retail', value: 'ecommerce' },
  { label: 'Other (type your own)', value: 'custom' }
];

const VOICE_OPTIONS = [
  { label: 'Professional & Authoritative', value: 'professional and authoritative' },
  { label: 'Friendly & Conversational', value: 'friendly and conversational' },
  { label: 'Technical & Precise', value: 'technical and precise' },
  { label: 'Educational & Supportive', value: 'educational and supportive' }
];

const CMS_OPTIONS = [
  { label: 'Local Markdown Files', value: 'local' },
  { label: 'Sanity CMS', value: 'sanity' }
];

const STEPS: Step[] = ['welcome', 'api-key', 'blog-name', 'blog-url', 'author', 'niche', 'audience', 'voice', 'cms', 'confirm'];
const TOTAL_STEPS = STEPS.length - 1; // Exclude welcome from count

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 80;
  const boxWidth = Math.min(termWidth - 4, 56);

  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState('');
  const [customNiche, setCustomNiche] = useState(false);

  // Input states for each field
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [blogNameInput, setBlogNameInput] = useState('');
  const [blogUrlInput, setBlogUrlInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [customNicheInput, setCustomNicheInput] = useState('');
  const [audienceInput, setAudienceInput] = useState('');

  // Config state
  const [apiKey, setApiKey] = useState(process.env.ANTHROPIC_API_KEY || '');
  const [config, setConfig] = useState<Partial<LeoConfig>>({
    blog: { name: '', niche: '', targetAudience: '', brandVoice: '', baseUrl: '' },
    author: { name: '' },
    cms: { provider: 'local' },
    queue: { provider: 'local' },
    imageStyle: { style: '3D isometric illustration', colorPalette: 'modern', background: 'light', theme: 'professional' },
    categories: []
  });

  const updateConfig = useCallback((path: string, value: string) => {
    setConfig(prev => {
      const updated = { ...prev };
      if (path.startsWith('blog.')) {
        updated.blog = { ...prev.blog!, [path.slice(5)]: value } as LeoConfig['blog'];
      } else if (path.startsWith('author.')) {
        updated.author = { ...prev.author!, [path.slice(7)]: value } as LeoConfig['author'];
      } else if (path.startsWith('cms.')) {
        updated.cms = { ...prev.cms!, provider: value as 'local' | 'sanity' };
      }
      return updated;
    });
  }, []);

  const currentStepIndex = STEPS.indexOf(step);
  const progress = step === 'welcome' ? 0 : Math.round(((currentStepIndex - 1) / (TOTAL_STEPS - 1)) * 100);

  const goNext = useCallback(() => {
    setError('');
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    }
  }, [step]);

  const goBack = useCallback(() => {
    setError('');
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
      setCustomNiche(false);
    }
  }, [step]);

  // Handle API key submit
  const handleApiKeySubmit = useCallback((val: string) => {
    const key = val.trim() || apiKey;
    if (!key) {
      setError('API key is required');
      return;
    }
    setApiKey(key);
    goNext();
  }, [apiKey, goNext]);

  // Handle text field submits
  const handleBlogNameSubmit = useCallback((val: string) => {
    if (!val.trim()) { setError('Blog name is required'); return; }
    updateConfig('blog.name', val.trim());
    goNext();
  }, [goNext, updateConfig]);

  const handleBlogUrlSubmit = useCallback((val: string) => {
    if (!val.trim()) { setError('URL is required'); return; }
    let url = val.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    updateConfig('blog.baseUrl', url);
    goNext();
  }, [goNext, updateConfig]);

  const handleAuthorSubmit = useCallback((val: string) => {
    if (!val.trim()) { setError('Author name is required'); return; }
    updateConfig('author.name', val.trim());
    goNext();
  }, [goNext, updateConfig]);

  const handleCustomNicheSubmit = useCallback((val: string) => {
    if (!val.trim()) { setError('Please describe your niche'); return; }
    updateConfig('blog.niche', val.trim());
    goNext();
  }, [goNext, updateConfig]);

  const handleAudienceSubmit = useCallback((val: string) => {
    if (!val.trim()) { setError('Target audience is required'); return; }
    updateConfig('blog.targetAudience', val.trim());
    goNext();
  }, [goNext, updateConfig]);

  // Handle select inputs
  const handleNicheSelect = useCallback((val: string) => {
    if (val === 'custom') {
      setCustomNiche(true);
    } else {
      updateConfig('blog.niche', val);
      goNext();
    }
  }, [goNext, updateConfig]);

  const handleVoiceSelect = useCallback((val: string) => {
    updateConfig('blog.brandVoice', val);
    goNext();
  }, [goNext, updateConfig]);

  const handleCmsSelect = useCallback((val: string) => {
    updateConfig('cms.provider', val);
    goNext();
  }, [goNext, updateConfig]);

  // Save and complete
  useEffect(() => {
    if (step === 'saving') {
      const timer = setTimeout(() => {
        try {
          const finalConfig = mergeWithDefaults(config);
          saveConfig(finalConfig);
          setStep('complete');
          setTimeout(() => onComplete(finalConfig), 1200);
        } catch {
          setError('Failed to save configuration');
          setStep('confirm');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [step, config, onComplete]);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'welcome') onCancel();
      else if (customNiche) setCustomNiche(false);
      else goBack();
    }
    if (key.return) {
      if (step === 'welcome') goNext();
      if (step === 'confirm') setStep('saving');
      if (step === 'api-key' && apiKey && !apiKeyInput) goNext();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Content
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <Box flexDirection="column" alignItems="center" paddingY={1}>
            <Gradient colors={['#f97316', '#fb923c', '#fdba74']}>
              <Text bold> LEO </Text>
            </Gradient>
            <Box marginTop={1}>
              <Text color={theme.textMuted}>AI Blog Writing Agent</Text>
            </Box>
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color={theme.text}>Quick setup to personalize your writing.</Text>
              <Text color={theme.textDim}>Takes about 1 minute.</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={claude.accent}>Press Enter to begin</Text>
            </Box>
          </Box>
        );

      case 'api-key':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Claude API Key</Text>
            {apiKey ? (
              <Box flexDirection="column" marginTop={1}>
                <StatusMessage variant="success">
                  Found: {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
                </StatusMessage>
                <Box marginTop={1}><Text color={theme.textDim}>Enter to continue, or paste a different key</Text></Box>
                <Box marginTop={1}>
                  <Text color={theme.textDim}>› </Text>
                  <PasswordInput
                    placeholder="Paste new key to override..."
                    onChange={setApiKeyInput}
                    onSubmit={handleApiKeySubmit}
                  />
                </Box>
              </Box>
            ) : (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.textMuted}>Get your key from console.anthropic.com</Text>
                <Box marginTop={1}>
                  <Text color={claude.accent}>› </Text>
                  <PasswordInput
                    placeholder="sk-ant-..."
                    onChange={setApiKeyInput}
                    onSubmit={handleApiKeySubmit}
                  />
                </Box>
              </Box>
            )}
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'blog-name':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Blog Name</Text>
            <Text color={theme.textMuted}>What's your blog or publication called?</Text>
            <Box marginTop={1}>
              <Text color={claude.accent}>› </Text>
              <TextInput
                placeholder="e.g., TechInsider, Marketing Weekly"
                onChange={setBlogNameInput}
                onSubmit={handleBlogNameSubmit}
              />
            </Box>
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'blog-url':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Website URL</Text>
            <Text color={theme.textMuted}>Your blog's domain (for internal links)</Text>
            <Box marginTop={1}>
              <Text color={claude.accent}>› </Text>
              <TextInput
                placeholder="e.g., myblog.com"
                onChange={setBlogUrlInput}
                onSubmit={handleBlogUrlSubmit}
              />
            </Box>
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'author':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Author Name</Text>
            <Text color={theme.textMuted}>Name shown on published articles</Text>
            <Box marginTop={1}>
              <Text color={claude.accent}>› </Text>
              <TextInput
                placeholder="e.g., Jane Smith"
                onChange={setAuthorInput}
                onSubmit={handleAuthorSubmit}
              />
            </Box>
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'niche':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Blog Niche</Text>
            <Text color={theme.textMuted}>What topics do you write about?</Text>
            {customNiche ? (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.textDim}>Describe your niche:</Text>
                <Box marginTop={1}>
                  <Text color={claude.accent}>› </Text>
                  <TextInput
                    placeholder="e.g., sustainable living, indie game dev"
                    onChange={setCustomNicheInput}
                    onSubmit={handleCustomNicheSubmit}
                  />
                </Box>
                <Box marginTop={1}><Text color={theme.textDim}>Esc to go back to list</Text></Box>
              </Box>
            ) : (
              <Box marginTop={1}>
                <Select options={NICHE_OPTIONS} onChange={handleNicheSelect} />
              </Box>
            )}
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'audience':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Target Audience</Text>
            <Text color={theme.textMuted}>Who are you writing for?</Text>
            <Box marginTop={1}>
              <Text color={claude.accent}>› </Text>
              <TextInput
                placeholder="e.g., startup founders, home cooks, developers"
                onChange={setAudienceInput}
                onSubmit={handleAudienceSubmit}
              />
            </Box>
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'voice':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Writing Style</Text>
            <Text color={theme.textMuted}>How should Leo write your content?</Text>
            <Box marginTop={1}>
              <Select options={VOICE_OPTIONS} onChange={handleVoiceSelect} />
            </Box>
          </Box>
        );

      case 'cms':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Content Storage</Text>
            <Text color={theme.textMuted}>Where should articles be saved?</Text>
            <Box marginTop={1}>
              <Select options={CMS_OPTIONS} onChange={handleCmsSelect} />
            </Box>
          </Box>
        );

      case 'confirm':
        return (
          <Box flexDirection="column">
            <Text bold color={claude.accent}>Review Setup</Text>
            <Box flexDirection="column" marginTop={1} marginLeft={1}>
              <Text><Text color={theme.textMuted}>Blog:</Text> {config.blog?.name}</Text>
              <Text><Text color={theme.textMuted}>URL:</Text> {config.blog?.baseUrl}</Text>
              <Text><Text color={theme.textMuted}>Author:</Text> {config.author?.name}</Text>
              <Text><Text color={theme.textMuted}>Niche:</Text> {config.blog?.niche}</Text>
              <Text><Text color={theme.textMuted}>Voice:</Text> {config.blog?.brandVoice}</Text>
              <Text><Text color={theme.textMuted}>Storage:</Text> {config.cms?.provider}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={theme.textDim}>Enter to save  ·  Esc to edit</Text>
            </Box>
            {error && <Box marginTop={1}><Text color={theme.error}>{error}</Text></Box>}
          </Box>
        );

      case 'saving':
        return (
          <Box paddingY={1}>
            <Spinner label="Saving configuration..." />
          </Box>
        );

      case 'complete':
        return (
          <Box flexDirection="column" alignItems="center" paddingY={1}>
            <StatusMessage variant="success">Setup complete!</StatusMessage>
            <Box marginTop={1}><Text color={theme.textMuted}>Configuration saved to leo.config.json</Text></Box>
            {apiKey && !process.env.ANTHROPIC_API_KEY && (
              <Box marginTop={1}><Text color={theme.warning}>Remember to add ANTHROPIC_API_KEY to your .env</Text></Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  const showProgress = !['welcome', 'saving', 'complete'].includes(step);
  const stepNum = Math.max(0, currentStepIndex - 1);

  return (
    <ThemeProvider theme={leoTheme}>
      <Box flexDirection="column" paddingX={1}>
        {/* Header */}
        <Box>
          <Text color={theme.border}>╭─</Text>
          <Text color={claude.accent}> Leo Setup </Text>
          {showProgress && (
            <>
              <Text color={theme.border}>─ </Text>
              <Text color={theme.textDim}>{stepNum}/{TOTAL_STEPS - 1}</Text>
            </>
          )}
          <Text color={theme.border}> {'─'.repeat(Math.max(0, boxWidth - (showProgress ? 20 : 14)))}╮</Text>
        </Box>

        {/* Progress bar */}
        {showProgress && (
          <Box paddingX={2} marginY={1}>
            <ProgressBar value={progress} />
          </Box>
        )}

        {/* Content */}
        <Box paddingX={2} paddingY={1}>
          <Box flexDirection="column" width={boxWidth - 4}>
            {renderStep()}
          </Box>
        </Box>

        {/* Footer */}
        <Box>
          <Text color={theme.border}>╰{'─'.repeat(boxWidth - 2)}╯</Text>
        </Box>

        {/* Navigation hint */}
        {showProgress && step !== 'confirm' && (
          <Box marginTop={1} paddingX={1}>
            <Text color={theme.textDim}>Esc back</Text>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default OnboardingWizard;
