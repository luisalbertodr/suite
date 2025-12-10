
import * as React from "react"
import { cn } from "@/lib/utils"

interface IbanInputProps extends Omit<React.ComponentProps<"input">, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

const IbanInput = React.forwardRef<HTMLInputElement, IbanInputProps>(
  ({ className, value = '', onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');
    
    // Formatear el valor para mostrar (con espacios cada 4 caracteres)
    const formatIban = (input: string) => {
      // Remover todos los espacios y convertir a mayúsculas
      const cleanInput = input.replace(/\s/g, '').toUpperCase();
      
      // Limitar a 24 caracteres máximo (6 grupos de 4)
      const limitedInput = cleanInput.slice(0, 24);
      
      // Agregar espacios cada 4 caracteres
      return limitedInput.replace(/(.{4})/g, '$1 ').trim();
    };

    // Actualizar el valor mostrado cuando cambia el prop value
    React.useEffect(() => {
      setDisplayValue(formatIban(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatIban(inputValue);
      setDisplayValue(formatted);
      
      // Llamar onChange con el valor sin espacios
      if (onChange) {
        onChange(formatted.replace(/\s/g, ''));
      }
    };

    return (
      <input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-mono tracking-wider",
          className
        )}
        placeholder="ES00 0000 0000 0000 0000 0000"
        {...props}
      />
    )
  }
)
IbanInput.displayName = "IbanInput"

export { IbanInput }
