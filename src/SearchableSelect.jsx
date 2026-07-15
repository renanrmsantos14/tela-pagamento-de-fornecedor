import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchTokens(value) {
  return String(value || "")
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizedSearchMatches(normalizedText, normalizedQuery, queryTokens) {
  if (!normalizedQuery) return true;
  if (!normalizedText) return false;
  if (normalizedText.includes(normalizedQuery)) return true;
  const tokens = queryTokens || searchTokens(normalizedQuery);
  return (
    tokens.length > 0 && tokens.every((token) => normalizedText.includes(token))
  );
}

export function searchableTextMatches(text, query) {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  return normalizedSearchMatches(normalizedText, normalizedQuery);
}

function shouldAutofocusSearch() {
  try {
    return !(
      window.matchMedia?.("(pointer: coarse)")?.matches ||
      window.matchMedia?.("(hover: none)")?.matches
    );
  } catch (_) {
    return true;
  }
}

function viewportMetrics() {
  const visual = window.visualViewport;
  return {
    width: Math.floor(
      visual?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0,
    ),
    height: Math.floor(
      visual?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0,
    ),
    offsetLeft: Math.floor(visual?.offsetLeft || 0),
    offsetTop: Math.floor(visual?.offsetTop || 0),
  };
}

function focusAdjacentControl(trigger, direction) {
  const scope = trigger?.closest(
    "form, .dashboard-filters, .filter-surface, .form-stack",
  );
  if (!scope) return;
  const controls = [
    ...scope.querySelectorAll(
      "input:not([type='hidden']), textarea, [data-searchable-select-trigger], button:not([type='submit'])",
    ),
  ].filter(
    (control) =>
      !control.disabled &&
      control.offsetParent !== null &&
      !control.closest("[hidden]"),
  );
  const currentIndex = controls.indexOf(trigger);
  const nextIndex =
    currentIndex >= 0
      ? currentIndex + direction
      : direction > 0
        ? 0
        : controls.length - 1;
  controls[Math.max(0, Math.min(controls.length - 1, nextIndex))]?.focus();
}

let selectSequence = 0;
const CUSTOM_SELECT_OPEN_EVENT = "betinhos:custom-select-open";

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Selecione",
  disabled = false,
  required = false,
  clearable = true,
  multiple = false,
  className = "",
  variant = "",
  name,
  "aria-label": ariaLabel,
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const suppressFocusRef = useRef(false);
  const focusSearchOnOpenRef = useRef(true);
  const focusOptionOnOpenRef = useRef(false);
  const initialHighlightRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [panelId] = useState(() => {
    selectSequence += 1;
    return `custom-options-${selectSequence}`;
  });

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        value: String(option?.value ?? ""),
        label: String(option?.label ?? ""),
        subtitle: option?.subtitle ? String(option.subtitle) : "",
        search: String(option?.search ?? ""),
        searchText: normalizeSearchText(
          `${option?.label ?? ""} ${option?.search ?? ""}`,
        ),
        disabled: Boolean(option?.disabled),
      })),
    [options],
  );
  const selectedValues = useMemo(
    () =>
      multiple
        ? [...new Set((Array.isArray(value) ? value : []).map(String))]
        : [String(value ?? "")],
    [multiple, value],
  );
  const selectedOptions = normalizedOptions.filter((option) =>
    selectedValues.includes(option.value),
  );
  const selectedOption = selectedOptions[0] || normalizedOptions[0];
  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const queryTokens = useMemo(
    () => searchTokens(normalizedQuery),
    [normalizedQuery],
  );
  const selectableOptions = useMemo(
    () => normalizedOptions.filter((option) => option.value !== ""),
    [normalizedOptions],
  );
  const enabledSelectableOptions = useMemo(
    () => selectableOptions.filter((option) => !option.disabled),
    [selectableOptions],
  );
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return selectableOptions;
    return selectableOptions.filter((option) =>
      normalizedSearchMatches(option.searchText, normalizedQuery, queryTokens),
    );
  }, [normalizedQuery, queryTokens, selectableOptions]);
  const hasEmptyOption = normalizedOptions.some(
    (option) => option.value === "",
  );
  const canClear =
    clearable &&
    !required &&
    !disabled &&
    (multiple
      ? selectedValues.length > 0
      : hasEmptyOption && String(value ?? "") !== "");

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewport = viewportMetrics();
    const safeInset = 8;
    const availableWidth = Math.max(120, viewport.width - safeInset * 2);
    const width = Math.max(
      120,
      Math.min(availableWidth, Math.max(140, Math.ceil(rect.width || 120))),
    );
    const maxHeight = Math.min(
      260,
      Math.max(120, Math.floor(viewport.height * 0.42)),
    );
    const viewportBottom = viewport.offsetTop + viewport.height;
    const viewportRight = viewport.offsetLeft + viewport.width;
    const spaceBelow = viewportBottom - rect.bottom - safeInset;
    const spaceAbove = rect.top - viewport.offsetTop - safeInset;
    const menuHeight = Math.min(
      maxHeight,
      Math.max(80, panelRef.current.scrollHeight || 0),
    );
    const showAbove =
      spaceBelow < Math.min(maxHeight, 180) && spaceAbove > spaceBelow;
    const top = showAbove
      ? Math.max(
          viewport.offsetTop + safeInset,
          rect.top - menuHeight - safeInset,
        )
      : Math.min(
          viewportBottom - menuHeight - safeInset,
          rect.bottom + safeInset,
        );
    const left = Math.max(
      viewport.offsetLeft + safeInset,
      Math.min(rect.left, viewportRight - width - safeInset),
    );
    panelRef.current.style.left = `${left}px`;
    panelRef.current.style.top = `${Math.max(viewport.offsetTop + safeInset, top)}px`;
    panelRef.current.style.width = `${width}px`;
    panelRef.current.style.maxHeight = `${maxHeight}px`;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    return undefined;
  }, [open, query, visibleOptions.length, updatePosition]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    const closeWhenAnotherSelectOpens = (event) => {
      if (event.detail !== panelId) {
        setOpen(false);
        optionRefs.current = [];
      }
    };
    window.addEventListener(CUSTOM_SELECT_OPEN_EVENT, closeWhenAnotherSelectOpens);
    return () =>
      window.removeEventListener(
        CUSTOM_SELECT_OPEN_EVENT,
        closeWhenAnotherSelectOpens,
      );
  }, [panelId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeIfOutside = (event) => {
      if (
        rootRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      )
        return;
      setOpen(false);
    };
    const reposition = () => updatePosition();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("focusin", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return undefined;
    }
    const selectedIndex = visibleOptions.findIndex((option) =>
      selectedValues.includes(option.value),
    );
    const nextHighlightedIndex =
      initialHighlightRef.current ?? Math.max(0, selectedIndex);
    setHighlightedIndex(nextHighlightedIndex);
    initialHighlightRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      if (focusOptionOnOpenRef.current) {
        focusOptionOnOpenRef.current = false;
        optionRefs.current[
          Math.max(0, nextHighlightedIndex)
        ]?.focus();
      } else if (focusSearchOnOpenRef.current && shouldAutofocusSearch())
        searchRef.current?.focus();
      else triggerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedValues, updatePosition]);

  const openSelect = (
    focusSearch = true,
    initialHighlight = null,
    focusOption = false,
  ) => {
    if (disabled) return;
    window.dispatchEvent(
      new CustomEvent(CUSTOM_SELECT_OPEN_EVENT, { detail: panelId }),
    );
    focusSearchOnOpenRef.current = focusSearch;
    focusOptionOnOpenRef.current = focusOption;
    initialHighlightRef.current = initialHighlight;
    setHasOpened(true);
    setQuery("");
    setOpen(true);
  };

  const closeSelect = () => {
    setOpen(false);
    optionRefs.current = [];
  };

  const selectOption = (option) => {
    if (disabled || option.disabled) return;
    if (multiple) {
      onChange(
        selectedValues.includes(option.value)
          ? selectedValues.filter((value) => value !== option.value)
          : [...selectedValues, option.value],
      );
      return;
    }
    onChange(option.value);
    closeSelect();
    suppressFocusRef.current = true;
    triggerRef.current?.focus();
    window.setTimeout(() => {
      suppressFocusRef.current = false;
    }, 0);
  };
  const allOptionsSelected =
    multiple &&
    enabledSelectableOptions.length > 0 &&
    enabledSelectableOptions.every((option) =>
      selectedValues.includes(option.value),
    );
  const toggleAllOptions = () =>
    onChange(
      allOptionsSelected
        ? []
        : enabledSelectableOptions.map((option) => option.value),
    );

  const moveHighlight = (direction) => {
    if (!visibleOptions.length) return;
    const activeElement = document.activeElement;
    const currentIndex = optionRefs.current.indexOf(activeElement);
    const baseIndex = currentIndex >= 0 ? currentIndex : highlightedIndex;
    const nextIndex =
      (baseIndex + direction + visibleOptions.length) % visibleOptions.length;
    setHighlightedIndex(nextIndex);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === "Tab") {
      closeSelect();
      return;
    }
    if ([" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        openSelect(
          false,
          event.key === "ArrowUp"
            ? Math.max(0, visibleOptions.length - 1)
            : null,
          event.key === "ArrowDown" || event.key === "ArrowUp",
        );
        return;
      }
      if (event.key === "ArrowDown") moveHighlight(1);
      if (event.key === "ArrowUp") moveHighlight(-1);
      if (event.key === "Enter" || event.key === " ") {
        const option = visibleOptions[highlightedIndex];
        if (option) selectOption(option);
      }
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      const option = visibleOptions[highlightedIndex] || visibleOptions[0];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
      closeSelect();
      focusAdjacentControl(triggerRef.current, event.shiftKey ? -1 : 1);
    }
  };

  const triggerLabel = multiple
    ? selectedOptions.length
      ? selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions[0].label} e mais ${selectedOptions.length - 1}`
      : placeholder
    : selectedOption?.label || placeholder;
  const rootClass = [
    "custom-select",
    variant && `custom-select--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const panelClass = [
    "custom-select-panel",
    variant && `custom-select-panel--${variant}`,
    visibleOptions.length === 0 && "is-empty",
    open && "is-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={`${rootClass}${open ? " is-open" : ""}`}>
      <select
        className="custom-select-native"
        name={name}
        multiple={multiple}
        value={multiple ? selectedValues : String(value ?? "")}
        disabled={disabled}
        required={required}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) =>
          onChange(
            multiple
              ? [...event.target.selectedOptions].map((option) => option.value)
              : event.target.value,
          )
        }
      >
        {normalizedOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        data-searchable-select-trigger="true"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onPointerDown={() => {
          suppressFocusRef.current = true;
          window.setTimeout(() => {
            suppressFocusRef.current = false;
          }, 0);
        }}
        onPointerCancel={() => {
          suppressFocusRef.current = false;
        }}
        onFocus={() => {
          if (
            !suppressFocusRef.current &&
            !open &&
            !disabled &&
            shouldAutofocusSearch()
          )
            openSelect(true);
        }}
        onClick={() => {
          if (open) closeSelect();
          else openSelect(true);
          suppressFocusRef.current = false;
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={`custom-select-value${(multiple ? selectedValues.length === 0 : String(value ?? "") === "") ? " is-placeholder" : ""}`}
        >
          {multiple && selectedOptions.length > 0 ? (
            <span className="custom-select-multiple-value">
              <span className="custom-select-multiple-primary">
                {selectedOptions[0].label}
              </span>
              {selectedOptions.length > 1 && (
                <span className="custom-select-multiple-count">
                  + {selectedOptions.length - 1} selecionado{selectedOptions.length > 2 ? "s" : ""}
                </span>
              )}
            </span>
          ) : (
            triggerLabel
          )}
        </span>
        <span
          className="custom-select-clear"
          role="button"
          tabIndex={canClear ? 0 : -1}
          aria-label="Limpar seleção"
          hidden={!canClear}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onChange(multiple ? [] : "");
            closeSelect();
            triggerRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              onChange(multiple ? [] : "");
              closeSelect();
              triggerRef.current?.focus();
            }
          }}
        />
        <span className="custom-select-caret" aria-hidden="true" />
      </button>
      {hasOpened &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={panelClass}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            aria-hidden={!open}
          >
            <input
              ref={searchRef}
              className="custom-select-search"
              type="text"
              value={query}
              placeholder="Pesquisar"
              autoComplete="off"
              spellCheck="false"
              aria-label="Pesquisar opção"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {multiple && enabledSelectableOptions.length > 0 && (
              <div className="custom-select-multiple-actions">
                <button
                  type="button"
                  className="custom-select-multiple-action"
                  onClick={toggleAllOptions}
                >
                  {allOptionsSelected ? "Limpar seleção" : "Selecionar todos"}
                </button>
              </div>
            )}
            <div className="custom-select-options">
              {visibleOptions.map((option, index) => (
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  key={option.value}
                  type="button"
                  className={`custom-select-option${multiple ? " custom-select-option--multiple" : ""}${index === highlightedIndex ? " is-active" : ""}${selectedValues.includes(option.value) ? " is-selected" : ""}`}
                  role="option"
                  aria-selected={selectedValues.includes(option.value)}
                  tabIndex={-1}
                  disabled={option.disabled}
                  onClick={() => selectOption(option)}
                >
                  {multiple && (
                    <span className="custom-select-option-check" aria-hidden="true" />
                  )}
                  {option.subtitle ? (
                    <>
                      <span className="custom-select-option-name">
                        {option.label}
                      </span>
                      <span className="custom-select-option-subtitle">
                        {option.subtitle}
                      </span>
                    </>
                  ) : (
                    option.label
                  )}
                </button>
              ))}
            </div>
            {!visibleOptions.length && (
              <div className="custom-select-no-results" aria-live="polite">
                Nenhuma opção encontrada
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function SearchableMultiSelect(props) {
  return <SearchableSelect {...props} multiple />;
}
