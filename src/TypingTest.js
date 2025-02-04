import React, { useState, useEffect, useRef, useCallback } from "react";
import "./TypingTest.css";

const defaultText =
  "This is a sample text for a typing test. Click on any character above to reposition your cursor.";

function TypingTest() {
  // Reference text and Change Text UI state.
  const [refText, setRefText] = useState(defaultText);
  const [showTextInput, setShowTextInput] = useState(false);
  const [newText, setNewText] = useState("");

  // State for whether the Change Text textarea is focused.
  const [textInputFocused, setTextInputFocused] = useState(false);

  // Core state for user input.
  // inputArr holds the user's keystrokes at positions in refText (undefined means not typed).
  const [inputArr, setInputArr] = useState([]);
  // lockedArr holds booleans for positions that have been locked as correct (green).
  const [lockedArr, setLockedArr] = useState([]);
  // cursor holds the current index in refText where the user is typing.
  const [cursor, setCursor] = useState(0);
  const [lastKey, setLastKey] = useState("");

  // Timing state for metrics.
  // startTime is set on the very first keystroke (or when new text is set) and is not reset on repositioning.
  const [startTime, setStartTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Ref for scrolling/focus.
  const topContainerRef = useRef(null);

  // -------------------------------
  // KEY HANDLING (using useCallback)
  // -------------------------------
  const handleKeyDown = useCallback(
    (e) => {
      if (textInputFocused) return; // Ignore global keys when Change Text editor is focused.

      // --- Arrow Keys (without modifiers) for simple cursor movement ---
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (cursor > 0) setCursor(cursor - 1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (cursor < refText.length) setCursor(cursor + 1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const candidate = findVerticalCandidate(-1);
          setCursor(candidate);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const candidate = findVerticalCandidate(1);
          // If candidate equals current cursor, check if we're at the last line:
          if (candidate === cursor) {
            const spans = topContainerRef.current.querySelectorAll("span");
            if (spans.length > 0) {
              const lastSpanRect = spans[spans.length - 1].getBoundingClientRect();
              const currentRect = spans[cursor] ? spans[cursor].getBoundingClientRect() : { top: 0 };
              if (Math.abs(currentRect.top - lastSpanRect.top) < 5) {
                setCursor(refText.length);
              } else {
                // Move to the first span of the next row.
                let nextRowIndices = [];
                spans.forEach((span, i) => {
                  const rect = span.getBoundingClientRect();
                  if (rect.top > currentRect.top + 5) {
                    nextRowIndices.push({ index: i, top: rect.top });
                  }
                });
                if (nextRowIndices.length > 0) {
                  nextRowIndices.sort((a, b) => a.top - b.top);
                  setCursor(nextRowIndices[0].index);
                }
              }
            }
          } else {
            setCursor(candidate);
          }
          return;
        }
      }

      // --- Control+ArrowLeft: Jump to beginning of previous word ---
      if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        let newIndex = cursor;
        while (newIndex > 0 && /\s/.test(refText[newIndex - 1])) {
          newIndex--;
        }
        while (newIndex > 0 && !/\s/.test(refText[newIndex - 1])) {
          newIndex--;
        }
        setCursor(newIndex);
        return;
      }

      // --- Control+ArrowRight: Jump to end of the next word ---
      if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        let newIndex = cursor;
        while (newIndex < refText.length && !/\s/.test(refText[newIndex])) {
          newIndex++;
        }
        while (newIndex < refText.length && /\s/.test(refText[newIndex])) {
          newIndex++;
        }
        setCursor(newIndex);
        return;
      }

      // --- Control+Backspace: Delete the previous word (only delete one word behind) ---
      if (e.key === "Backspace" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        let newIndex = cursor;
        while (newIndex > 0 && /\s/.test(refText[newIndex - 1])) {
          newIndex--;
        }
        while (newIndex > 0 && !/\s/.test(refText[newIndex - 1])) {
          newIndex--;
        }
        const newArr = [...inputArr];
        for (let j = newIndex; j < cursor; j++) {
          newArr[j] = undefined;
        }
        setInputArr(newArr);
        setCursor(newIndex);
        setStartTime(Date.now());
        setLastKey("CtrlBackspace");
        return;
      }

      // --- Normal Backspace: Delete a single character ---
      if (e.key === "Backspace") {
        e.preventDefault();
        if (cursor > 0 && lockedArr[cursor - 1]) {
          // If the character immediately before the cursor is locked, just move the cursor left.
          setCursor(cursor - 1);
        } else if (cursor > 0) {
          const newArr = [...inputArr];
          newArr[cursor - 1] = undefined;
          setInputArr(newArr);
          setCursor(cursor - 1);
          setStartTime(Date.now());
        }
        setLastKey("Backspace");
        return;
      }

      // Prevent default scrolling on space.
      if (e.key === " ") {
        e.preventDefault();
      }

      let ch = "";
      if (e.key === "Enter") {
        ch = "\n";
      } else if (e.key.length === 1) {
        ch = e.key;
      } else {
        return;
      }
      setLastKey(ch);

      if (!startTime) {
        setStartTime(Date.now());
      }

      if (cursor < refText.length) {
        const newArr = [...inputArr];
        newArr[cursor] = ch;
        setInputArr(newArr);
        if (ch === refText[cursor]) {
          const newLocked = [...lockedArr];
          newLocked[cursor] = true;
          setLockedArr(newLocked);
        }
        setCursor(cursor + 1);
      }
    },
    [textInputFocused, cursor, inputArr, refText, startTime, lockedArr]
  );

  // Helper: Find a vertical candidate for up/down arrow keys.
  const findVerticalCandidate = (direction) => {
    if (!topContainerRef.current) return cursor;
    const spans = topContainerRef.current.querySelectorAll("span");
    if (!spans[cursor]) return cursor;
    const currentRect = spans[cursor].getBoundingClientRect();
    let candidateIndex = cursor;
    let bestDiff = Infinity;
    spans.forEach((span, i) => {
      const rect = span.getBoundingClientRect();
      // For up arrow, we need spans with rect.top < currentRect.top.
      // For down arrow, we need spans with rect.top > currentRect.top.
      if (direction === -1 && rect.top < currentRect.top) {
        // Horizontal difference
        const diff = Math.abs(rect.left - currentRect.left);
        if (diff < bestDiff) {
          bestDiff = diff;
          candidateIndex = i;
        }
      }
      if (direction === 1 && rect.top > currentRect.top) {
        const diff = Math.abs(rect.left - currentRect.left);
        if (diff < bestDiff) {
          bestDiff = diff;
          candidateIndex = i;
        }
      }
    });
    return candidateIndex;
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // -------------------------------
  // AUTO-SCROLLING (Top Section)
  // -------------------------------
  useEffect(() => {
    if (topContainerRef.current) {
      const spans = topContainerRef.current.querySelectorAll("span");
      if (spans[cursor]) {
        spans[cursor].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [cursor, refText, lastKey]);

  // -------------------------------
  // TIMER UPDATE FOR METRICS
  // -------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------
  // CURSOR REPOSITIONING (on Click)
  // -------------------------------
  const handleTopClick = (i) => {
    const newArr = [...inputArr];
    for (let j = i; j < refText.length; j++) {
      if (!lockedArr[j]) {
        newArr[j] = undefined;
      }
    }
    setInputArr(newArr);
    setCursor(i);
    setStartTime(Date.now());
    if (topContainerRef.current) {
      topContainerRef.current.focus();
    }
  };

  // -------------------------------
  // SUBMIT NEW TEXT FUNCTIONALITY
  // -------------------------------
  const handleSetText = () => {
    setRefText(newText);
    setInputArr([]);
    setLockedArr([]);
    setCursor(0);
    setStartTime(null);
    setShowTextInput(false);
    setNewText("");
  };

  // -------------------------------
  // METRICS COMPUTATION
  // -------------------------------
  const computeMetrics = () => {
    let correctCount = 0;
    let typedCount = 0;
    for (let i = 0; i < refText.length; i++) {
      if (inputArr[i] !== undefined) {
        typedCount++;
        if (lockedArr[i] || inputArr[i] === refText[i]) {
          correctCount++;
        }
      }
    }
    const accuracy = typedCount > 0 ? (correctCount / typedCount) * 100 : 100;
    const elapsedMinutes = startTime ? (currentTime - startTime) / 60000 : 0;
    const wpm = elapsedMinutes > 0 ? (typedCount / 5) / elapsedMinutes : 0;
    const percentFinished = (correctCount / refText.length) * 100;
    return { accuracy, wpm, percentFinished };
  };

  const { accuracy, wpm, percentFinished } = computeMetrics();

  // -------------------------------
  // RENDERING THE TOP VIEW
  // -------------------------------
  const renderTopText = () => {
    const characters = refText.split("");
    const rendered = characters.map((char, i) => {
      let className = "";
      if (inputArr[i] !== undefined) {
        if (lockedArr[i]) {
          className = "correct";
        } else {
          className = inputArr[i] === char ? "correct" : "incorrect";
        }
      }
      if (i === cursor) {
        className += " current";
      }
      return (
        <span key={i} className={className} onClick={() => handleTopClick(i)}>
          {char}
        </span>
      );
    });
    // If the cursor is at or beyond the last character, append an extra blinking caret.
    if (cursor >= characters.length) {
      rendered.push(
        <span key="cursor" className="current">&nbsp;</span>
      );
    }
    return rendered;
  };

  // -------------------------------
  // RENDERING THE BOTTOM METRICS VIEW
  // -------------------------------
  const renderMetrics = () => {
    return (
      <div id="metricsContainer">
        <span>Accuracy: {accuracy.toFixed(1)}%</span>
        <span>WPM: {wpm.toFixed(1)}</span>
        <span>Completed: {percentFinished.toFixed(1)}%</span>
      </div>
    );
  };

  // -------------------------------
  // COMPONENT RENDERING
  // -------------------------------
  return (
    <div className="container">
      <div className="header">
        <button onClick={() => setShowTextInput((prev) => !prev)}>
          Change Text
        </button>
        <div className="header-text">
          <h1>Typing Test</h1>
          <p>
            Type the text below. Press Enter for newline, Backspace to delete, and Ctrl+Backspace to delete the previous word.
            <br />
            Use the arrow keys (including up/down and Ctrl+ArrowLeft/Right) to reposition your cursor.
            <br />
            Click any character above to reposition your cursor.
          </p>
        </div>
        {showTextInput && (
          <div className="text-input">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Paste your new text here..."
              onFocus={() => setTextInputFocused(true)}
              onBlur={() => setTextInputFocused(false)}
            />
            <button onClick={handleSetText}>Set Text</button>
          </div>
        )}
      </div>
      <div className="content">
        <div id="fullTextContainer" ref={topContainerRef}>
          {renderTopText()}
        </div>
        {renderMetrics()}
      </div>
    </div>
  );
}

export default TypingTest;
