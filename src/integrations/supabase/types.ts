export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contratos: {
        Row: {
          concepto: string
          id: string
          moneda: string
          monto: number
          proveedor_id: string
          tipo: string
        }
        Insert: {
          concepto: string
          id: string
          moneda: string
          monto: number
          proveedor_id: string
          tipo: string
        }
        Update: {
          concepto?: string
          id?: string
          moneda?: string
          monto?: number
          proveedor_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_bancarias: {
        Row: {
          banco: string
          id: string
          moneda: string
          numero: string
          saldo_disponible: number
        }
        Insert: {
          banco: string
          id: string
          moneda: string
          numero: string
          saldo_disponible?: number
        }
        Update: {
          banco?: string
          id?: string
          moneda?: string
          numero?: string
          saldo_disponible?: number
        }
        Relationships: []
      }
      decisiones: {
        Row: {
          ajuste: Json | null
          aprobado_en: string | null
          aprobador: string | null
          categoria: string | null
          comentario_aprobacion: string | null
          controles: Json
          cuenta_pago: string | null
          decidido_en: string
          decidido_por: string
          decision: string
          escalar_a: string | null
          estado: string
          factura_id: string
          factura_relacionada_id: string | null
          fecha_programada_pago: string | null
          id: string
          monto_usd: number | null
          motivo: string
          politica_version: string | null
          proveedor_id: string | null
        }
        Insert: {
          ajuste?: Json | null
          aprobado_en?: string | null
          aprobador?: string | null
          categoria?: string | null
          comentario_aprobacion?: string | null
          controles?: Json
          cuenta_pago?: string | null
          decidido_en?: string
          decidido_por: string
          decision: string
          escalar_a?: string | null
          estado: string
          factura_id: string
          factura_relacionada_id?: string | null
          fecha_programada_pago?: string | null
          id?: string
          monto_usd?: number | null
          motivo: string
          politica_version?: string | null
          proveedor_id?: string | null
        }
        Update: {
          ajuste?: Json | null
          aprobado_en?: string | null
          aprobador?: string | null
          categoria?: string | null
          comentario_aprobacion?: string | null
          controles?: Json
          cuenta_pago?: string | null
          decidido_en?: string
          decidido_por?: string
          decision?: string
          escalar_a?: string | null
          estado?: string
          factura_id?: string
          factura_relacionada_id?: string | null
          fecha_programada_pago?: string | null
          id?: string
          monto_usd?: number | null
          motivo?: string
          politica_version?: string | null
          proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisiones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisiones_factura_relacionada_id_fkey"
            columns: ["factura_relacionada_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisiones_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          actividad: string | null
          direccion: string
          id: number
          id_fiscal: string
          moneda_reporte: string
          pais_constitucion: string
          razon_social: string
        }
        Insert: {
          actividad?: string | null
          direccion: string
          id?: number
          id_fiscal: string
          moneda_reporte?: string
          pais_constitucion: string
          razon_social: string
        }
        Update: {
          actividad?: string | null
          direccion?: string
          id?: number
          id_fiscal?: string
          moneda_reporte?: string
          pais_constitucion?: string
          razon_social?: string
        }
        Relationships: []
      }
      facturas: {
        Row: {
          archivo_url: string | null
          canal: string | null
          codigo: string | null
          confianza_extraccion: number | null
          creada_en: string
          descripcion: string | null
          emisor: string | null
          fecha_emision: string | null
          fecha_recepcion: string | null
          fecha_vencimiento: string | null
          id: string
          moneda: string | null
          monto: number | null
          nombre_archivo: string | null
          numero: string | null
          pago_banco: string | null
          pago_cuenta: string | null
          receptor: string | null
          texto_original: string | null
          tipo_documento: string | null
        }
        Insert: {
          archivo_url?: string | null
          canal?: string | null
          codigo?: string | null
          confianza_extraccion?: number | null
          creada_en?: string
          descripcion?: string | null
          emisor?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          nombre_archivo?: string | null
          numero?: string | null
          pago_banco?: string | null
          pago_cuenta?: string | null
          receptor?: string | null
          texto_original?: string | null
          tipo_documento?: string | null
        }
        Update: {
          archivo_url?: string | null
          canal?: string | null
          codigo?: string | null
          confianza_extraccion?: number | null
          creada_en?: string
          descripcion?: string | null
          emisor?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          nombre_archivo?: string | null
          numero?: string | null
          pago_banco?: string | null
          pago_cuenta?: string | null
          receptor?: string | null
          texto_original?: string | null
          tipo_documento?: string | null
        }
        Relationships: []
      }
      pagos_previos: {
        Row: {
          categoria: string
          cuenta: string
          decidido_por: string
          factura: string
          fecha_pago: string
          id: string
          moneda: string
          monto: number
          monto_usd: number
          proveedor_id: string
        }
        Insert: {
          categoria: string
          cuenta: string
          decidido_por: string
          factura: string
          fecha_pago: string
          id: string
          moneda: string
          monto: number
          monto_usd: number
          proveedor_id: string
        }
        Update: {
          categoria?: string
          cuenta?: string
          decidido_por?: string
          factura?: string
          fecha_pago?: string
          id?: string
          moneda?: string
          monto?: number
          monto_usd?: number
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_previos_cuenta_fkey"
            columns: ["cuenta"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_previos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      politicas: {
        Row: {
          creada_en: string
          creada_por: string
          id: string
          parametros: Json
          version: string
          vigente: boolean
        }
        Insert: {
          creada_en?: string
          creada_por: string
          id?: string
          parametros: Json
          version: string
          vigente?: boolean
        }
        Update: {
          creada_en?: string
          creada_por?: string
          id?: string
          parametros?: Json
          version?: string
          vigente?: boolean
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          banco_beneficiario: string | null
          categoria: string
          cuenta_beneficiario: string | null
          cuenta_pago: string
          expediente_completo: boolean
          id: string
          moneda_factura: string
          nombre: string
          pais: string
          permite_conversion: boolean
          tipo: string
        }
        Insert: {
          activo?: boolean
          banco_beneficiario?: string | null
          categoria: string
          cuenta_beneficiario?: string | null
          cuenta_pago: string
          expediente_completo?: boolean
          id: string
          moneda_factura: string
          nombre: string
          pais: string
          permite_conversion?: boolean
          tipo: string
        }
        Update: {
          activo?: boolean
          banco_beneficiario?: string | null
          categoria?: string
          cuenta_beneficiario?: string | null
          cuenta_pago?: string
          expediente_completo?: boolean
          id?: string
          moneda_factura?: string
          nombre?: string
          pais?: string
          permite_conversion?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_cuenta_pago_fkey"
            columns: ["cuenta_pago"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_eventos: {
        Row: {
          actor: string
          detalle: string | null
          evento: string
          factura_id: string | null
          fecha_hora: string
          id: string
        }
        Insert: {
          actor: string
          detalle?: string | null
          evento: string
          factura_id?: string | null
          fecha_hora?: string
          id?: string
        }
        Update: {
          actor?: string
          detalle?: string | null
          evento?: string
          factura_id?: string | null
          fecha_hora?: string
          id?: string
        }
        Relationships: []
      }
      tipos_cambio: {
        Row: {
          id: string
          moneda: string
          por_usd: number
          vigente_desde: string
          vigente_hasta: string
        }
        Insert: {
          id?: string
          moneda: string
          por_usd: number
          vigente_desde: string
          vigente_hasta: string
        }
        Update: {
          id?: string
          moneda?: string
          por_usd?: number
          vigente_desde?: string
          vigente_hasta?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cargar_datos_maestros: { Args: never; Returns: undefined }
      gestionar_baja_proveedor: {
        Args: { p_accion: string; p_actor: string; p_id: string }
        Returns: string
      }
      guardar_proveedor: {
        Args: {
          p_actor: string
          p_contrato: Json
          p_nuevo: boolean
          p_proveedor: Json
        }
        Returns: string
      }
      historial_proveedor: { Args: { p_id: string }; Returns: Json }
      normalizar_nombre_proveedor: { Args: { valor: string }; Returns: string }
      reiniciar_demo: { Args: never; Returns: undefined }
      seed_demo_si_vacio: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
