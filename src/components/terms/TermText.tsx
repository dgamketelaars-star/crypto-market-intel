import { Fragment } from 'react';
import { glossaryKeys } from '../../data/mock/glossary';
import { Term } from './Term';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termPattern = new RegExp(`\\b(${glossaryKeys.map(escapeRegExp).join('|')})\\b`, 'gi');

/** Renders text with known glossary terms turned into clickable Term buttons. */
export function TermText({ text }: { text: string }) {
  const parts = text.split(termPattern);

  return (
    <>
      {parts.map((part, index) => {
        const matchedKey = glossaryKeys.find((key) => key.toLowerCase() === part.toLowerCase());
        return (
          <Fragment key={index}>
            {matchedKey ? <Term termKey={matchedKey} label={part} /> : part}
          </Fragment>
        );
      })}
    </>
  );
}
