"use client";
import * as Primitive from "@radix-ui/react-select";
import { useRef, useState, type ComponentProps } from "react";

export interface SelectOption {
  value: string;
  label: string;
}
type Props = Omit<
  ComponentProps<typeof Primitive.Trigger>,
  "value" | "onChange" | "children"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  name?: string;
  placeholder?: string;
};
const emptyValue = "__taskflow_empty__";

export function Select({
  value,
  onValueChange,
  options,
  name,
  placeholder = "Selecione",
  disabled,
  ...props
}: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <Primitive.Root
      name={name}
      value={value || emptyValue}
      disabled={disabled}
      onOpenChange={(open) => {
        if (open)
          setContainer(trigger.current?.closest("dialog") ?? document.body);
      }}
      onValueChange={(next) => onValueChange(next === emptyValue ? "" : next)}
    >
      <Primitive.Trigger
        {...props}
        ref={trigger}
        name={name}
        data-value={value}
        className="select-trigger"
      >
        <Primitive.Value placeholder={placeholder} />
        <Primitive.Icon className="select-chevron" aria-hidden>
          ⌄
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={container}>
        <Primitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <Primitive.ScrollUpButton
            className="select-scroll"
            aria-label="Rolar opções para cima"
          >
            ⌃
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="select-viewport">
            {options.map((option) => (
              <Primitive.Item
                className="select-option"
                data-select-value={option.value}
                key={option.value}
                value={option.value || emptyValue}
              >
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
                <Primitive.ItemIndicator className="select-check">
                  ✓
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton
            className="select-scroll"
            aria-label="Rolar opções para baixo"
          >
            ⌄
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
