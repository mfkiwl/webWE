import mupif
import copy
import Pyro5
import threading
import mupif_examples_models
import logging
log = logging.getLogger()


@Pyro5.api.expose
class ThermoMechanicalClassWorkflow_01(mupif.Workflow):

    def __init__(self, metadata={}):
        MD = {
            "ClassName": "ThermoMechanicalClassWorkflow_01",
            "ModuleName": "example02",
            "Name": "Thermo-mechanical class workflow",
            "ID": "thermomechanical_class_workflow_01",
            "Description": "",
            "Execution_settings": {
                "Type": "Local",
            },
            "Inputs": [
                {"Name": "top_temperature", "Type": "mupif.Property", "Required": True, "description": "", "Type_ID": "mupif.DataID.PID_Temperature", "Obj_ID": "top_temperature", "Units": "degC", "Set_at": "timestep", "ValueType": "Scalar"},
                {"Name": "input_file_thermal", "Type": "mupif.PyroFile", "Required": True, "description": "", "Type_ID": "mupif.DataID.ID_InputFile", "Obj_ID": "input_file_thermal", "Units": "none", "Set_at": "initialization"},
                {"Name": "input_file_mechanical", "Type": "mupif.PyroFile", "Required": True, "description": "", "Type_ID": "mupif.DataID.ID_InputFile", "Obj_ID": "input_file_mechanical", "Units": "none", "Set_at": "initialization"},
            ],
            "Outputs": [
                {"Name": "temperature", "Type": "mupif.Field", "description": "", "Type_ID": "mupif.DataID.FID_Temperature", "Obj_ID": "temperature", "Units": ""},
                {"Name": "displacement", "Type": "mupif.Field", "description": "", "Type_ID": "mupif.DataID.FID_Displacement", "Obj_ID": "displacement", "Units": ""},
            ],
            "Models": [
                {
                    'Name': 'model_1',
                    'Module': 'mupif_examples_models',
                    'Class': 'ThermalNonstatModel',
                },
                {
                    'Name': 'model_2',
                    'Module': 'mupif_examples_models',
                    'Class': 'MechanicalModel',
                },
            ],
        }
        super().__init__(metadata=MD)
        self.updateMetadata(metadata)
        self.daemon = None

        # initialization code of external input (top_temperature)
        self.external_input_1 = None
        # It should be defined from outside using set() method.

        # initialization code of external input (input_file_thermal)
        self.external_input_2 = None
        # It should be defined from outside using set() method.

        # initialization code of external input (input_file_mechanical)
        self.external_input_3 = None
        # It should be defined from outside using set() method.
        
        # __init__ code of constant_property_1 (Property)
        self.constant_property_1 = mupif.property.ConstantProperty(value=0.0, propID=mupif.DataID.PID_Temperature, valueType=mupif.ValueType.Scalar, unit=mupif.U.deg_C, time=None)


    def initialize(self, workdir='', metadata={}, validateMetaData=True, **kwargs):
        super().initialize(workdir=workdir, metadata=metadata, validateMetaData=validateMetaData, **kwargs)

        ns = mupif.pyroutil.connectNameServer()
        self.daemon = mupif.pyroutil.getDaemon(ns)

    # set method for all external inputs
    def set(self, obj, objectID=0):

        # in case of mupif.PyroFile
        if obj.isInstance(mupif.PyroFile):
            pass
            if objectID == 'input_file_thermal':
                self.external_input_2 = obj
                self.model_1.set(self.external_input_2, 'input_file_thermal_nonstat')
            if objectID == 'input_file_mechanical':
                self.external_input_3 = obj
                self.model_2.set(self.external_input_3, 'input_file_mechanical')

        # in case of mupif.Property
        if obj.isInstance(mupif.Property):
            pass
            if objectID == 'top_temperature':
                self.external_input_1 = obj

        # in case of mupif.Field
        if obj.isInstance(mupif.Field):
            pass

    # get method for all external outputs
    def get(self, objectTypeID, time=None, objectID=0):
        if objectID == 'temperature':
            return self.model_1.get(mupif.DataID.FID_Temperature, time, '')
        if objectID == 'displacement':
            return self.model_2.get(mupif.DataID.FID_Displacement, time, '')

        return None

    def solveStep(self, tstep, stageID=0, runInBackground=False):
        pass
        
        # execution code of model_1 (Non-stationary thermal problem)
        self.model_1.set(self.external_input_1, 'Cauchy top')
        self.model_1.set(self.constant_property_1, 'Dirichlet bottom')
        self.model_1.set(self.constant_property_1, 'Dirichlet left')
        self.model_1.solveStep(tstep)
        
        # execution code of model_2 (Plane stress linear elastic)
        self.model_2.set(self.model_1.get(mupif.DataID.FID_Temperature, tstep.getTime(), ''), '')
        self.model_2.solveStep(tstep)


