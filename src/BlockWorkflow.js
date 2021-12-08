class BlockWorkflow extends Block{
    constructor(editor, parent_block){
        super(editor, null);
        this.name = 'Workflow';

        this.project_name = 'My unnamed project';
        this.project_classname = 'MyUnnamedProject';
        this.project_modulename = 'MyModuleName';
        this.project_id = 'my_unnamed_project_01';


        this.exec_type = "Local";
        this.exec_settings_jobmanagername = "";
        this.exec_settings_nsport = "";
        this.exec_settings_nshost = "";

        this.project_nshost = '127.0.0.1';// default localhost
        this.project_nsport = '0';// zero can be default to search all ports for nameserver

        this.jobman_name = '';
        this.jobman_server_host = '';// default localhost
        this.jobman_server_port = '';
        this.jobman_nshost = '';
        this.jobman_nsport = '';
        
        this.script_name_base = '';
    }

    getAllExternalDataSlots(inout){
        return this.getSlots(inout);
    }

    generateOutputDataSlotGetFunction(slot, time=""){
        return slot.getCodeRepresentation();
    }

    canGenerateCode(type){
        if(type === 'exec'){
            let result = true;
            if(this.getSlots().length) {
                result = false;
                console.log('Execution code cannot be generated with external inputs.');
                if(this.editor.visual)
                    myQuery_show_error('Execution code cannot be generated with external inputs.');
            }
            let blocks = this.getBlocksRecursive(BlockTimeloop);
            if(!blocks.length) {
                result = false;
                console.log('Execution code cannot be generated without a Timeloop or another block defining a timestep.');
                if(this.editor.visual)
                    myQuery_show_error('Execution code cannot be generated without a Timeloop or another block defining a timestep.');
            }
            return result;
        }
        if(type === 'class'){
            return true;
        }
        if(type === 'server'){
            return true;
        }
        console.log('Type of code is not valid!');
        return false;
    }

    generateAllElementCodeNames(){
        this.code_name = 'workflow';
        let blocks = this.getBlocksRecursive();
        for(let i=0;i<blocks.length;i++)
            blocks[i].code_name = "";
        for(let i=0;i<blocks.length;i++)
            blocks[i].generateCodeName(blocks);
        let slots = this.getSlotsRecursive();
        for(let i=0;i<slots.length;i++)
            slots[i].id = '';
        slot_id = 0;
        for(let i=0;i<slots.length;i++)
            if(!slots[i].external)
                slots[i].id = generateNewSlotID();
        slots = this.getAllExternalDataSlots('in');
        for(let i=0;i<slots.length;i++)
            slots[i].id = 'external_output_'+(i+1);
        slots = this.getAllExternalDataSlots('out');
        for(let i=0;i<slots.length;i++)
            slots[i].id = 'external_input_'+(i+1);
    }

    generateCodeForServer(){

        console.log('Generating Python code for server.');
        if(this.canGenerateCode('server')) {
            let code = ["import mupif", "import copy"];
            code.push("import "+this.script_name_base);
            code.push("");
            code.push("if __name__ == '__main__':");
            code.push("\t# code to run the jobmanager server");
            code.push("");
            code.push("\tns = mupif.pyroutil.connectNameServer(nshost='"+this.editor.getJobmanNSHost()+"', nsport="+this.editor.getJobmanNSPort()+")");
            code.push("");
            code.push("\tjobMan = mupif.SimpleJobManager(");
            code.push("\t\tappClass="+this.script_name_base+"."+this.project_classname+",");
            code.push("\t\tserver='"+this.editor.getJobmanServerHost()+"',");
            code.push("\t\tnshost='"+this.editor.getJobmanNSHost()+"',");
            code.push("\t\tnsport="+this.editor.getJobmanNSPort()+",");
            code.push("\t\tns=ns,");
            code.push("\t\tappName='"+this.editor.getJobmanName()+"',");
            code.push("\t\tjobManWorkDir='.',");
            code.push("\t\tmaxJobs=10");
            code.push("\t)");
            code.push("");
            code.push("\tmupif.pyroutil.runJobManagerServer(");
            code.push("\t\tserver='"+this.editor.getJobmanServerHost()+"',");
            code.push("\t\tport="+this.editor.getJobmanServerPort()+",");
            code.push("\t\tnshost='"+this.editor.getJobmanNSHost()+"',");
            code.push("\t\tnsport="+this.editor.getJobmanNSPort()+",");
            code.push("\t\tjobman=jobMan");
            code.push("\t)");
            code.push("");

            return replace_tabs_with_spaces_for_each_line(code);
        }
        return '';
        
    }
    
    generateCode(class_code){
        
        console.log('Generating Python code.');
        if(this.canGenerateCode(class_code ? 'class' : 'exec')) {

            let num_of_external_input_dataslots = 0;

            this.generateAllElementCodeNames();

            let all_model_blocks = this.getBlocksRecursive(BlockModel);
            let child_blocks = this.getBlocks();
            
            let code = [];

            // TODO
            // code.push("import sys");
            // code.push("sys.path.append(\"C:\\Projects\\mupif_current_dev\")");
            // code.push("");
            
            code.push("import mupif");
            code.push("import copy");
            code.push("import Pyro5");
            code.push("import threading");
            
            let model_blocks = this.getBlocksRecursive(BlockModel);
            let imported_modules = [];
            for (let i = 0; i < model_blocks.length; i++) {
                if (model_blocks[i].model_module !== "") {
                    if (!imported_modules.includes(model_blocks[i].model_module)) {
                        code.push("import " + model_blocks[i].model_module);
                        imported_modules.push(model_blocks[i].model_module);
                    }
                }
            }

            code.push("import logging");

            code.push("log = logging.getLogger()");

            code.push("");
            code.push("");
            code.push("@Pyro5.api.expose");
            code.push("class " + this.project_classname + "(mupif.workflow.Workflow):");

            // --------------------------------------------------
            // __init__ function
            // --------------------------------------------------

            code.push("");
            code.push("\tdef __init__(self, metadata={}):");

            code.push("\t\tMD = {");
            code.push("\t\t\t\"ClassName\": \"" + this.project_classname + "\",");
            code.push("\t\t\t\"ModuleName\": \"" + this.project_modulename + "\",");
            code.push("\t\t\t\"Name\": \"" + this.project_name + "\",");
            code.push("\t\t\t\"ID\": \"" + this.project_id + "\",");
            code.push("\t\t\t\"Description\": \"\",");

            if (class_code) {
                code.push("\t\t\t\"Execution_settings\": {");
                code.push("\t\t\t\t\"Type\": \"" + this.exec_type + "\",");
                if (this.exec_type === 'Distributed') {
                    code.push("\t\t\t\t\"jobManName\": \"" + this.jobman_name + "\",");
                    code.push("\t\t\t\t\"nshost\": \"" + this.jobman_nshost + "\",");
                    code.push("\t\t\t\t\"nsport\": \"" + this.jobman_nsport + "\"");
                }
                code.push("\t\t\t},");
            }


            let slots;
            let params;
            let s;
            code.push("\t\t\t\"Inputs\": [");
            slots = this.getAllExternalDataSlots("out");
            for (let i = 0; i < slots.length; i++) {
                s = slots[i];
                if (s.connected()) {
                    num_of_external_input_dataslots += 1;
                    params = "\"Name\": \"" + s.name + "\", \"Type\": \"" + s.type + "\", " +
                        "\"Required\": True, \"description\": \"\", " +
                        "\"Type_ID\": \"" + s.getLinkedDataSlot().getObjType() + "\", " +
                        "\"Obj_ID\": [\"" + s.getObjID() + "\"], " +
                        "\"Units\": \"\", " +
                        "\"Set_at\": \""+(s.getLinkedDataSlot().set_at === 'initialization' ? 'initialization' : 'timestep')+"\"";
                    code.push("\t\t\t\t{" + params + "},");
                }
            }
            code.push("\t\t\t],");

            code.push("\t\t\t\"Outputs\": [");
            slots = this.getAllExternalDataSlots("in");
            for (let i = 0; i < slots.length; i++) {
                s = slots[i];
                if (s.connected()) {
                    num_of_external_input_dataslots += 1;
                    params = "\"Name\": \"" + s.name + "\", \"Type\": \"" + s.type + "\", " +
                        "\"description\": \"\", " +
                        "\"Type_ID\": \"" + s.getLinkedDataSlot().getObjType() + "\", " +
                        "\"Obj_ID\": [\"" + s.getObjID() + "\"], " +
                        "\"Units\": \"\"";
                    code.push("\t\t\t\t{" + params + "},");
                }
            }
            code.push("\t\t\t],");

            code.push("\t\t}");

            code.push("\t\tmupif.workflow.Workflow.__init__(self, metadata=MD)");

            code.push("\t\tself.updateMetadata(metadata)");
            
            code.push("\t\tself.daemon = None");

            let code_add;
            if (class_code) {
                // initialization of workflow inputs
                slots = this.getAllExternalDataSlots("out");
                for (let i = 0; i < slots.length; i++) {
                    s = slots[i];
                    if (s.connected()) {
                        code.push("");
                        code.push("\t\t# initialization code of external input ("+slots[i].obj_id+")");
                        code.push("\t\t" + s.getCodeRepresentation() + " = None");
                        code.push("\t\t# It should be defined from outside using set() method.");
                    }
                }
            }

            // init codes of child blocks

            let allBlocksRecursive = this.getBlocksRecursive();
            for (let i = 0; i < allBlocksRecursive.length; i++)
                extend_array(code, allBlocksRecursive[i].getInitCode(2));
            
            code.push("");
            
            // --------------------------------------------------
            // initialize function
            // --------------------------------------------------

            code.push("");
            code.push("\tdef initialize(self, workdir='', metadata={}, validateMetaData=True, **kwargs):");
            code.push("");

            code.push("\t\tself.updateMetadata(dictionary=metadata)");

            code.push("");
            
            code.push("\t\texecMD = {");
            code.push("\t\t\t'Execution': {");
            code.push("\t\t\t\t'ID': self.getMetadata('Execution.ID'),");
            code.push("\t\t\t\t'Use_case_ID': self.getMetadata('Execution.Use_case_ID'),");
            code.push("\t\t\t\t'Task_ID': self.getMetadata('Execution.Task_ID')");
            code.push("\t\t\t}");
            code.push("\t\t}");

            code.push("");
            
            code.push("\t\tns = mupif.pyroutil.connectNameServer(nshost='"+this.editor.getJobmanNSHost()+"', nsport="+this.editor.getJobmanNSPort()+")");
            code.push("\t\tself.daemon = mupif.pyroutil.getDaemon(ns)");
            
            code.push("");
            
            for (let i = 0; i < allBlocksRecursive.length; i++) {
                extend_array(code, allBlocksRecursive[i].getInitializationCode(2, "execMD"));
            }

            code.push("");

            for (let i = 0; i < all_model_blocks.length; i++)
                code.push("\t\tself.registerModel(self." + all_model_blocks[i].getCodeName() + ", \"" + all_model_blocks[i].getCodeName() + "\")");

            code.push("");

            code.push("\t\tmupif.Workflow.initialize(self, workdir=workdir, metadata={}, validateMetaData=validateMetaData, **kwargs)");
            
            // setting of the inputs for initialization
            let linked_slot;
            let timestep_time = "None";
            for (let i = 0; i < allBlocksRecursive.length; i++) {
                slots = allBlocksRecursive[i].getSlots('in');
                for (let si = 0; si < slots.length; si++) {
                    if (slots[si].set_at === 'initialization') {
                        let obj_id;
                        linked_slot = slots[si].getLinkedDataSlot();
                        if (linked_slot != null) {
                            if(!(linked_slot instanceof SlotExt)){
                                obj_id = slots[si].obj_id;
                                if (typeof obj_id === 'string')
                                    obj_id = "'" + obj_id + "'";
                                code.push("");
                                code.push("\t\tself." + allBlocksRecursive[i].code_name + ".set(" + linked_slot.getParentBlock().generateOutputDataSlotGetFunction(linked_slot, timestep_time) + ", " + obj_id + ")");
                            }
                        }
                    }
                }
            }

            // --------------------------------------------------
            // get critical time step function
            // --------------------------------------------------

            let model;
            if (class_code) {
                code.push("");
                code.push("\tdef getCriticalTimeStep(self):");
                code_add = "";
                let ii = 0;
                for (let i = 0; i < child_blocks.length; i++) {
                    model = child_blocks[i];
                    if (model instanceof BlockModel) {
                        if (ii)
                            code_add += ", ";
                        code_add += "self." + model.code_name + ".getCriticalTimeStep()";
                        ii += 1;
                    }
                }
                code.push("\t\treturn min([" + code_add + "])");
                
                // --------------------------------------------------
                // set method
                // --------------------------------------------------

                code.push("");
                code.push("\t# set method for all external inputs");
                code.push("\tdef set(self, obj, objectID=0):");

                let linked_model;
                let value_types = ["mupif.PyroFile", "mupif.Property", "mupif.Field"];
                for(let vi=0;vi<value_types.length;vi++){
                    code.push("");
                    code.push("\t\t# in case of " + value_types[vi]);
                    code.push("\t\tif obj.isInstance(" + value_types[vi] + "):");
                    code.push("\t\t\tpass");
                    slots = this.getAllExternalDataSlots("out");
                    for (let i = 0; i < slots.length; i++) {
                        s = slots[i];
                        if (s.connected())
                            if (s.type === value_types[vi]) {
                                code.push("\t\t\tif objectID == '" + s.name + "':");
                                if(s.type === "mupif.PyroFile"){
                                    code.push("\t\t\t\t" + s.getCodeRepresentation() + " = obj");
                                    linked_model = s.getLinkedDataSlot().getParentBlock();
                                    code.push("\t\t\t\t" + linked_model.getCodeName() + ".set(" + s.getCodeRepresentation() + ", '" + s.getLinkedDataSlot().obj_id + "')"); //s.getCodeRepresentation() + " = obj");
                                }else
                                    code.push("\t\t\t\t" + s.getCodeRepresentation() + " = obj");
                            }
                    }
                }
                
                // --------------------------------------------------
                // get method
                // --------------------------------------------------

                code.push("");
                code.push("\t# get method for all external outputs");
                code.push("\tdef get(self, objectTypeID, time=None, objectID=0):");

                slots = this.getAllExternalDataSlots("in");
                for (let i = 0; i < slots.length; i++) {
                    s = slots[i];
                    if (s.connected())
                        code.push("\t\tif objectID == '" + s.name + "':");
                        code.push("\t\t\treturn " + s.getLinkedDataSlot().getParentBlock().generateOutputDataSlotGetFunction(s.getLinkedDataSlot(), 'time'))
                }

                code.push("");
                code.push("\t\treturn None");
            }

            // --------------------------------------------------
            // terminate method
            // --------------------------------------------------

            code.push("");
            code.push("\tdef terminate(self):");
            code.push("\t\tpass");
            for (let i = 0; i < all_model_blocks.length; i++) {
                model = all_model_blocks[i];
                code.push("\t\tself." + model.code_name + ".terminate()");
            }

            // --------------------------------------------------
            // finishstep method
            // --------------------------------------------------

            code.push("");
            code.push("\tdef finishStep(self, tstep):");
            code.push("\t\tpass");
            for (let i = 0; i < all_model_blocks.length; i++) {
                model = all_model_blocks[i];
                code.push("\t\tself." + model.code_name + ".finishStep(tstep)");
            }
            code.push("");

            // --------------------------------------------------
            // solve or solveStep function
            // --------------------------------------------------

            if (class_code)
                code.push("\tdef solveStep(self, tstep, stageID=0, runInBackground=False):");
            else
                code.push("\tdef solve(self, runInBackground=False):");

            code.push("\t\tpass");

            for (let i = 0; i < child_blocks.length; i++) {
                model = child_blocks[i];
                if (class_code)
                    code = code.concat(model.getExecutionCode(2, "tstep", false));
                else
                    code = code.concat(model.getExecutionCode(2, "", true));
            }

            code.push("");
            code.push("");

            // --------------------------------------------------
            // execution part
            // --------------------------------------------------

            if (!class_code) {
                code.push("if __name__ == '__main__':");
                code.push("\tproblem = " + this.project_classname + "()");
                code.push("");
                code.push("\t# these metadata are supposed to be filled before execution");
                code.push("\tmd = {");
                code.push("\t\t'Execution': {");
                code.push("\t\t\t'ID': 'N/A',");
                code.push("\t\t\t'Use_case_ID': 'N/A',");
                code.push("\t\t\t'Task_ID': 'N/A'");
                code.push("\t\t}");
                code.push("\t}");
                code.push("\tproblem.initialize(metadata=md)");
                code.push("\tproblem.solve()");
                code.push("\tproblem.terminate()");
                code.push("");
                code.push("\tprint('Simulation has finished.')");
                code.push("");
            }

            return replace_tabs_with_spaces_for_each_line(code);
        }
        return '';
    }

    defineMenu() {
        super.defineMenu();
        this.addAddBlockItems();
        this.addAddExternalSlotItems();
        this.addOrderingMenuItems();
    }

    getClassName() {
        return 'BlockWorkflow';
    }

    getDictForJSON(){
        this.generateAllElementCodeNames();

        let ext_slots = [];
        let data_blocks = [];
        let data_datalinks = [];
        let slots;

        slots = this.getSlots();
        for(let i=0;i<slots.length;i++)
            ext_slots.push(slots[i].getDictForJSON());

        let elem_self = {
            'classname': this.getClassName(),
            'uid': this.getUID(),
            'parent_uid': 'None',
            'ext_slots': ext_slots,
            'child_block_sort': this.child_block_sort
        };

        data_blocks.push(elem_self);

        let blocks = this.getBlocksRecursive();
        for(let i=0;i<blocks.length;i++){
            data_blocks.push(blocks[i].getDictForJSON());
        }

        for(let i=0;i<this.editor.datalinks.length;i++){
            data_datalinks.push(this.editor.datalinks[i].getDictForJSON());
        }

        let settings = {
            'project_name': this.project_name,
            'project_classname': this.project_classname,
            'project_modulename': this.project_modulename,
            'project_id': this.project_id,
            'project_nshost': this.project_nshost,
            'project_nsport': this.project_nsport,
            'script_name_base': this.script_name_base,
            'connection_type': this.exec_type
        };
        
        let jobman_settings = {};
        let jobman_to_save = false;
        if(this.jobman_name) {
            jobman_to_save = true;
            jobman_settings['name'] = this.jobman_name;
        }
        if(this.jobman_server_host) {
            jobman_to_save = true;
            jobman_settings['server_host'] = this.jobman_server_host;
        }
        if(this.jobman_server_port) {
            jobman_to_save = true;
            jobman_settings['server_port'] = this.jobman_server_port;
        }
        if(this.jobman_nshost) {
            jobman_to_save = true;
            jobman_settings['nshost'] = this.jobman_nshost;
        }
        if(this.jobman_nsport) {
            jobman_to_save = true;
            jobman_settings['nsport'] = this.jobman_nsport;
        }
        
        if(jobman_to_save)
            settings['jobman_settings'] = jobman_settings;
        
        return {'blocks': data_blocks, 'datalinks': data_datalinks, 'settings': settings};
    }

    // #########################
    // ########## NEW ##########
    // #########################

    getBlockHtmlClass(){
        return 'we_block we_block_workflow';
    }

    getBlockHtmlName(){
        return 'Workflow';
    }

    getBlockHtml_params(){
        let html = '';
        html += '<div class="bl_params">';
        html += 'Name = <b>\'' + this.project_name + '\'</b>';
        html += '<br>';
        html += 'ClassName = <b>\'' + this.project_classname + '\'</b>';
        html += '<br>';
        html += 'ID = <b>\'' + this.project_id + '\'</b>';

        html += '</div>';
        return html;
    }

    getBlockHtmlContent(){
        let html = '';
        html += this.getBlockHtml_header();
        html += this.getBlockHtml_params();
        html += '<table cellspacing="0" class="table_over_content">';
        html += '<tr><td>';
        html += this.getBlockHtml_slots_output();
        html += '</td><td>';
        html += this.getBlockHtml_content();
        html += '</td><td>';
        html += this.getBlockHtml_slots_input();
        html += '</td></tr>';
        html += '</table>';
        html += this.getBlockHtml_footer();
        html += this.getBlockHtml_menu();
        return html;
    }

}