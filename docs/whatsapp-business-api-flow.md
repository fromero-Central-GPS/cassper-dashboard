# Flujo de WhatsApp Business API (GHL Integration)

Este documento describe el flujo diseñado para interactuar con clientes a través de WhatsApp Business API, utilizando GoHighLevel (GHL) como intermediario.

## 1. Regla de las 24 horas

- **¿Qué es?** WhatsApp solo permite enviar mensajes de formato libre (texto, imágenes, etc.) si el cliente ha enviado un mensaje en las últimas 24 horas. Esta es la "ventana de 24 horas".
- **¿Qué pasa fuera de la ventana?** Si han pasado más de 24 horas, solo se pueden enviar Plantillas de Mensajes Altamente Estructurados (HSM - Highly Structured Messages) que deben ser pre-aprobadas por Meta.

## 2. HSM Templates (Plantillas)

Para recontactar leads perdidos (como los de nuestro experimento), necesitaremos HSMs.

### Ejemplos de Templates a usar:

1.  **Reactivación de Cotización (Utility):**
    *   Hola {{1}}, ¿sigues interesado en tu cotización para GPS? Responde "Sí" para actualizar los precios o "No" si ya lo resolviste.
2.  **Oferta Especial (Marketing):**
    *   ¡Hola {{1}}! Tenemos un descuento del 15% en planes anuales este mes. ¿Te interesa que te envíe los detalles?

*Nota: Estos templates deben ser creados en el Dashboard de Meta (o a través de la integración de GHL si lo permite directamente) y esperar su aprobación.*

## 3. Flujo de Aprobación (Humano-in-the-loop)

Dado que son mensajes automatizados, implementaremos un flujo de aprobación para asegurar la calidad:

1.  **Generación:** El Agente (Paperclip/Claude) detecta la oportunidad perdida (vía el MVP de la Fase 1) y redacta el borrador del mensaje (eligiendo el HSM apropiado o texto libre si la ventana está abierta).
2.  **Revisión:** El mensaje se guarda en una cola de revisión (ej. base de datos local o un estado específico en GHL).
3.  **Aprobación Humana:** Un humano (ej. el CEO o el vendedor) revisa la cola en el dashboard y aprueba o edita el mensaje.
4.  **Envío:** Una vez aprobado, el sistema llama a la API de GHL para enviarlo.

## 4. Restricciones de Horario Hábil

Para evitar molestar a los clientes y cumplir con buenas prácticas (y posibles regulaciones locales):

-   **Horario de envío permitido:** Lunes a Viernes, de 09:00 a 18:00 (Hora de Chile).
-   **Implementación:** Antes de enviar (incluso si está aprobado), el sistema verificará la hora actual. Si está fuera de horario, se pondrá en cola para el siguiente día hábil.

## 5. Próximos Pasos (Implementación)

-   [ ] Crear modelo en DB (whatsapp_queue) para manejar borradores, aprobaciones y estado de envío.
-   [ ] Crear UI en el Dashboard para que el humano apruebe los mensajes.
-   [ ] Implementar la función de chequeo de horario en el script de envío.
-   [ ] (Requiere acción humana) Configurar y aprobar los HSM en la plataforma de WhatsApp/GHL.

